from app.core.events import EventType
from app.core.job_store import JobStore


async def test_create_and_emit(sample_tickets):
    store = JobStore()
    job = store.create(sample_tickets[:2])
    assert job.total_tickets == 2
    await job.emit(EventType.JOB_STARTED, {"total": 2})
    events = job.events_snapshot()
    assert len(events) == 1
    assert events[0].id == 1


async def test_event_ids_monotonic(sample_tickets):
    store = JobStore()
    job = store.create(sample_tickets[:1])
    for _ in range(5):
        await job.emit(EventType.JOB_PROGRESS, {})
    ids = [e.id for e in job.events_snapshot()]
    assert ids == list(range(1, 6))


async def test_subscribe_replays_history(sample_tickets):
    store = JobStore()
    job = store.create(sample_tickets[:1])
    await job.emit(EventType.JOB_STARTED, {})
    await job.emit(EventType.JOB_PROGRESS, {"completed": 1, "total": 1})
    queue = await job.subscribe()
    assert queue.qsize() == 2


async def test_subscribe_with_last_event_id(sample_tickets):
    store = JobStore()
    job = store.create(sample_tickets[:1])
    await job.emit(EventType.JOB_STARTED, {})
    await job.emit(EventType.JOB_PROGRESS, {})
    await job.emit(EventType.JOB_COMPLETE, {})
    queue = await job.subscribe(last_event_id=2)  # only replay event id > 2
    assert queue.qsize() == 1


async def test_unsubscribe_removes_listener(sample_tickets):
    store = JobStore()
    job = store.create(sample_tickets[:1])
    queue = await job.subscribe()
    await job.unsubscribe(queue)
    # After unsubscribe, new emits don't reach the queue
    await job.emit(EventType.JOB_PROGRESS, {})
    assert queue.qsize() == 0
