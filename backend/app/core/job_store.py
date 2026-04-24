"""In-memory job store with per-job event queues and ring buffer replay.

Design notes
────────────
- Single process, single worker. Swap to Redis pub/sub for multi-worker.
- Each job keeps a bounded ring buffer of `Event`s for memory safety.
- Connected SSE clients each get their own bounded `asyncio.Queue`; on
  subscribe we replay past events from the buffer filtered by `last_event_id`.
- A `cancel_event` allows cooperative cancellation from the HTTP layer.
- Periodic sweep deletes jobs older than TTL to prevent leaks.
- All mutations of shared state (events, listeners, status) go through
  `_lock` to keep concurrent emits/subscribes/cancels race-free.
"""

from __future__ import annotations

import asyncio
import logging
import secrets
from collections import deque
from datetime import UTC, datetime, timedelta

from app.core.events import Event, EventType
from app.models.schemas import JobStatus, JobSummary, TicketInput, TicketResult

logger = logging.getLogger(__name__)

RING_BUFFER_SIZE = 2000
LISTENER_QUEUE_MAXSIZE = 2000


class Job:
    """A single scraping job with its event stream."""

    __slots__ = (
        "id",
        "tickets",
        "status",
        "progress",
        "created_at",
        "completed_at",
        "results",
        "summary",
        "_events",
        "_listeners",
        "_next_event_id",
        "cancel_event",
        "_lock",
    )

    def __init__(self, tickets: list[TicketInput]):
        # 96 bits of entropy — collision-safe and fits a URL slug
        self.id: str = secrets.token_urlsafe(12)
        self.tickets: list[TicketInput] = tickets
        self.status: JobStatus = JobStatus.PENDING
        self.progress: int = 0
        self.created_at: datetime = datetime.now(UTC)
        self.completed_at: datetime | None = None
        self.results: list[TicketResult] = []
        self.summary: JobSummary = JobSummary(total=len(tickets))
        # Bounded deque keeps memory predictable on long jobs
        self._events: deque[Event] = deque(maxlen=RING_BUFFER_SIZE)
        self._listeners: list[asyncio.Queue[Event]] = []
        self._next_event_id: int = 1
        self.cancel_event: asyncio.Event = asyncio.Event()
        self._lock: asyncio.Lock = asyncio.Lock()

    @property
    def total_tickets(self) -> int:
        return len(self.tickets)

    @property
    def is_terminal(self) -> bool:
        return self.status in {JobStatus.COMPLETED, JobStatus.CANCELLED, JobStatus.FAILED}

    def events_snapshot(self) -> list[Event]:
        """Public read-only view of recent events (for tests and snapshots)."""
        return list(self._events)

    async def emit(self, event_type: EventType, data: dict | None = None) -> Event:
        async with self._lock:
            event = Event(id=self._next_event_id, type=event_type, data=data or {})
            self._next_event_id += 1
            self._events.append(event)
            for q in self._listeners:
                # Drop event for slow listeners instead of blocking the producer
                try:
                    q.put_nowait(event)
                except asyncio.QueueFull:
                    logger.warning(
                        "Listener queue full — dropping event for job",
                        extra={"job_id": self.id, "event_id": event.id},
                    )
            return event

    async def subscribe(self, last_event_id: int | None = None) -> asyncio.Queue[Event]:
        """Attach a new listener. Replays buffered events after `last_event_id`."""
        async with self._lock:
            q: asyncio.Queue[Event] = asyncio.Queue(maxsize=LISTENER_QUEUE_MAXSIZE)
            cutoff = last_event_id or 0
            for ev in self._events:
                if ev.id > cutoff:
                    try:
                        q.put_nowait(ev)
                    except asyncio.QueueFull:
                        # Replay larger than queue: keep the most recent fit.
                        break
            self._listeners.append(q)
            return q

    async def unsubscribe(self, q: asyncio.Queue[Event]) -> None:
        async with self._lock:
            try:
                self._listeners.remove(q)
            except ValueError:
                pass


class JobStore:
    """Central registry of jobs + their orchestrator tasks."""

    def __init__(self, ttl_seconds: int = 3600):
        self._jobs: dict[str, Job] = {}
        self._tasks: dict[str, asyncio.Task] = {}
        self._lock: asyncio.Lock = asyncio.Lock()
        self._ttl = timedelta(seconds=ttl_seconds)
        self._sweeper: asyncio.Task | None = None

    def create(self, tickets: list[TicketInput]) -> Job:
        job = Job(tickets)
        self._jobs[job.id] = job
        return job

    def get(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

    def get_or_raise(self, job_id: str) -> Job:
        job = self._jobs.get(job_id)
        if job is None:
            raise KeyError(job_id)
        return job

    def track_task(self, job_id: str, task: asyncio.Task) -> None:
        self._tasks[job_id] = task
        # Surface unhandled exceptions instead of getting a destroyed-task warning
        task.add_done_callback(self._on_task_done)

    def get_task(self, job_id: str) -> asyncio.Task | None:
        return self._tasks.get(job_id)

    async def cancel(self, job_id: str) -> bool:
        job = self.get(job_id)
        if job is None:
            return False
        async with job._lock:
            if job.is_terminal:
                return False
            job.cancel_event.set()
        task = self._tasks.get(job_id)
        if task and not task.done():
            task.cancel()
        return True

    @staticmethod
    def _on_task_done(task: asyncio.Task) -> None:
        if task.cancelled():
            return
        exc = task.exception()
        if exc is not None:
            logger.exception("Background job task failed", exc_info=exc)

    # ─── Cleanup ───────────────────────────────────────────────

    async def start_sweeper(self, interval_seconds: int = 300) -> None:
        self._sweeper = asyncio.create_task(self._sweep_loop(interval_seconds))

    async def stop_sweeper(self) -> None:
        if self._sweeper and not self._sweeper.done():
            self._sweeper.cancel()
            try:
                await self._sweeper
            except asyncio.CancelledError:
                pass

    async def _sweep_loop(self, interval: int) -> None:
        while True:
            try:
                await asyncio.sleep(interval)
                await self._sweep_once()
            except asyncio.CancelledError:
                raise
            except (RuntimeError, MemoryError, OSError) as exc:
                logger.warning("Job store sweep failed", exc_info=exc)

    async def _sweep_once(self) -> None:
        now = datetime.now(UTC)
        # Snapshot to avoid "dictionary changed size during iteration"
        for job_id, job in list(self._jobs.items()):
            reference = job.completed_at or job.created_at
            if job.is_terminal and now - reference > self._ttl:
                self._jobs.pop(job_id, None)
                t = self._tasks.pop(job_id, None)
                if t and not t.done():
                    t.cancel()
