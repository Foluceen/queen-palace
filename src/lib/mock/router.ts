import { routes, type EndpointName, type HttpMethod } from "@/lib/api/contract";

interface CompiledRoute {
  name: EndpointName;
  method: HttpMethod;
  regex: RegExp;
  keys: string[];
}

const compiled: CompiledRoute[] = (Object.keys(routes) as EndpointName[]).map((name) => {
  const { method, path } = routes[name];
  const keys: string[] = [];
  const pattern = path.replace(/:([A-Za-z]+)/g, (_, k: string) => {
    keys.push(k);
    return "([^/]+)";
  });
  return { name, method, regex: new RegExp(`^${pattern}$`), keys };
});

// Static segments win over params (e.g. PUT /admin/collections/order before /admin/collections/:id).
compiled.sort((a, b) => a.keys.length - b.keys.length);

export function matchRoute(method: string, path: string): { name: EndpointName; params: Record<string, string> } | null {
  for (const r of compiled) {
    if (r.method !== method) continue;
    const m = r.regex.exec(path);
    if (!m) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1] ?? "")));
    return { name: r.name, params };
  }
  return null;
}
