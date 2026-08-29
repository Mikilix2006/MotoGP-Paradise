const MOTOGP_API_URL =
"https://api.motogp.pulselive.com/motogp/v1";

export async function motogpFetch<T>(
endpoint: string
): Promise<T> {
const response = await fetch(
`${MOTOGP_API_URL}${endpoint}`,
{
headers: {
Accept: "application/json",
},
next: {
revalidate: 60,
},
}
);

if (!response.ok) {
throw new Error(
`MotoGP API error: ${response.status} ${response.statusText}`
);
}

return response.json() as Promise<T>;
}
