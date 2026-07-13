import { apiDownload } from "@/lib/api";

export async function downloadTournamentReport(tournamentId: string, tournamentName: string) {
  const blob = await apiDownload(`/tournaments/${tournamentId}/reports/pdf`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${tournamentName.replace(/\s+/g, "_")}_report.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
