export interface JwtPayload {
  sub: string;
  businessId: string;
  branchId: string | null;
  username: string;
  email: string | null;
}
