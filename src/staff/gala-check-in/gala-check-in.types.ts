export type TicketStatus = "ACTIVE" | "REVOKED" | "EXPIRED";
export type RedeemStatus = "NOT_REDEEMED" | "REDEEMED";

export type GalaPreview = {
  ok: true;
  ticket: {
    ticketId: string;
    status: TicketStatus;
    expiresAt?: string | null;
    redeemStatus: RedeemStatus;
    redeemedAt?: string | null;
    redeemedBy?: { _id: string; email: string | null } | null;
    order: {
      orderId: string;
      name: string;
      email: string;
      ticketCount: number;
      totalAmount: number;
      currency: string;
      paymentStatus: string;
      paidAt?: string | null;
    } | null;
  };
};

export type GalaConfirm = {
  ok: true;
  message: string;
  alreadyRedeemed?: boolean;
  ticket: GalaPreview["ticket"];
};