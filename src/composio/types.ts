export type ComposioConnectionStatus = "INITIATED" | "ACTIVE" | "EXPIRED" | "FAILED";

export type ComposioConnectedAccount = {
  id: string;
  appName: string;
  status: ComposioConnectionStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type ComposioInitiateConnectionResult = {
  connectedAccountId: string;
  redirectUrl: string;
};

export type ComposioToolkitInfo = {
  name: string;
  displayName?: string;
  description?: string;
  appId?: string;
};
