const SAMPLE_CSV = `ticket_id,first_name,last_name,dob
B24H011196,JESUS,PARRA,10/16/1998
B25W010815,JONATHAN,TORRES,11/11/1990
B23B0116825,JUAN,SOTO,2/22/1958
B24C009043,MARTIN,WILLIAMS,6/20/1992
A25X001111,MARIE,DUBOIS,3/15/1985
A24Y002222,PIERRE,MARTIN,7/30/1972
C25Z003333,SOPHIE,LEFEBVRE,12/5/1988
D26A004444,THOMAS,BERNARD,1/25/1995
E25B005555,ISABELLA,GARCIA,8/14/1991
F24C006666,LUCAS,RODRIGUEZ,4/3/1983
`;

export function downloadSampleCsv() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "winit-sample-tickets.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
