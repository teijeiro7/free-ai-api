// Response.json() is typed `unknown` under strict mode; tests just want to poke
// at fields, so this narrows once instead of casting at every call site.
export async function readJson<T = Record<string, any>>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
