const MOTOGP_API_URL =
  process.env.MOTOGP_API_URL;

export async function fetchMotoGPApi<T>(
  endpoint: string
): Promise<T> {
  const url = `${MOTOGP_API_URL}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `MotoGP API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}