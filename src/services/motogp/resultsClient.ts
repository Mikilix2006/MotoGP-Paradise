const MOTOGP_RESULTS_API_URL =
  process.env.MOTOGP_RESULTS_API_URL;

export async function fetchMotoGPResults<T>(
  endpoint: string
): Promise<T> {
  const url = `${MOTOGP_RESULTS_API_URL}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `MotoGP Results API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}