/** Browser shim for next/server in the static preview: there is no request to wait for. */
export async function connection(): Promise<void> {}
