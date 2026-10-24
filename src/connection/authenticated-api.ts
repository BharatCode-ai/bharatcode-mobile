import { API, Json } from "../domain/types";
import { ApiError } from "./api-client";
/** Observe revocation consistently, including supporting file/configuration requests. */
export class AuthenticatedAPI implements API {
  constructor(
    private inner: API,
    private revoked: (error: ApiError) => void,
  ) {}
  async request<T = Json>(...args: Parameters<API["request"]>): Promise<T> {
    try {
      return await this.inner.request<T>(...args);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) this.revoked(e);
      throw e;
    }
  }
  events(...args: Parameters<API["events"]>) {
    return this.inner.events(...args);
  }
  liveEvents(...args: Parameters<API["liveEvents"]>) {
    return this.inner.liveEvents(...args);
  }
  close() {
    this.inner.close();
  }
}
