import { supabase } from "./supabase";
import { formatMoney } from "./billing";
import { formatOrderDayShort } from "./orderNumber";

export type UdhaarCustomerSummary = {
  id: string;
  name: string;
  phone: string;
  credit_limit: number | null;
  balance: number;
  open_bills: number;
  oldest_due_since: string | null;
  last_payment_at: string | null;
};

export type UdhaarCustomersResponse = {
  customers: UdhaarCustomerSummary[];
  total_due: number;
  customers_with_due: number;
};

export type UdhaarCustomerSearchResult = {
  id: string;
  name: string;
  phone: string;
  credit_limit: number | null;
  balance: number;
};

export type UdhaarBillItem = {
  bill_id: string;
  bill_no_text: string;
  bill_day: string;
  created_at: string;
  total: number;
  status: string;
  payment_status: string;
  due: number;
  share_token: string | null;
};

export type UdhaarPaymentAllocation = {
  bill_no_text: string;
  amount: number;
};

export type UdhaarPaymentItem = {
  id: string;
  amount: number;
  method: "cash" | "upi" | "card" | string;
  note: string | null;
  created_at: string;
  reversed_at: string | null;
  reverse_reason: string | null;
  allocations: UdhaarPaymentAllocation[];
};

export type UdhaarCustomerDetail = {
  customer: {
    id: string;
    name: string;
    phone: string;
    credit_limit: number | null;
    notes: string | null;
    created_at: string;
  };
  balance: number;
  bills: UdhaarBillItem[];
  payments: UdhaarPaymentItem[];
};

export type UdhaarPutBillOnCreditResult = {
  customer_id: string;
  balance_after: number;
};

export type UdhaarPaymentApplied = {
  bill_id: string;
  bill_no_text: string;
  amount: number;
  fully_paid: boolean;
};

export type UdhaarReceivePaymentResult = {
  payment_id: string;
  amount: number;
  applied: UdhaarPaymentApplied[];
  balance_after: number;
};

export type UdhaarBillInfo = {
  bill_id: string;
  customer_id: string;
  customer_name: string;
  due: number;
};

/**
 * Checks whether an error indicates that the udhaar RPC functions do not exist in the database.
 */
export function isUdhaarMissingError(err: unknown): boolean {
  if (!err) return false;
  const errObj = typeof err === "object" ? (err as Record<string, unknown>) : null;
  const code = errObj?.code;
  const msg =
    typeof err === "string"
      ? err
      : err instanceof Error
      ? err.message
      : typeof errObj?.message === "string"
      ? errObj.message
      : "";

  if (code === "PGRST202") return true;
  if (/could not find the function/i.test(msg)) return true;
  if (/does not exist/i.test(msg) && /tapx_/i.test(msg)) return true;
  return false;
}

/**
 * Formats an error into a user-facing string, handling missing RPCs gracefully.
 */
export function formatUdhaarError(err: unknown): string {
  if (isUdhaarMissingError(err)) {
    return "Udhaar is not enabled on this account yet.";
  }
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  const errObj = typeof err === "object" ? (err as Record<string, unknown>) : null;
  if (typeof errObj?.message === "string") return errObj.message;
  return "An unexpected error occurred.";
}

/**
 * Parses the error message when credit limit is exceeded.
 * Returns the description text after "LIMIT_EXCEEDED:" or null if not a limit exceeded error.
 */
export function parseLimitExceeded(err: unknown): string | null {
  if (!err) return null;
  const errObj = typeof err === "object" ? (err as Record<string, unknown>) : null;
  const msg =
    typeof err === "string"
      ? err
      : err instanceof Error
      ? err.message
      : typeof errObj?.message === "string"
      ? errObj.message
      : "";

  const prefix = "LIMIT_EXCEEDED:";
  const idx = msg.indexOf(prefix);
  if (idx !== -1) {
    return msg.slice(idx + prefix.length).trim();
  }
  return null;
}

/**
 * Fetches the list of udhaar customers for a business along with aggregate totals.
 */
export async function udhaarListCustomers(
  businessId: string,
  onlyDue: boolean = true
): Promise<UdhaarCustomersResponse> {
  const { data, error } = await supabase.rpc("tapx_credit_customers", {
    p_business_id: businessId,
    p_only_due: onlyDue,
  });

  if (error) {
    throw new Error(formatUdhaarError(error));
  }

  const raw = data as UdhaarCustomersResponse | null;
  return {
    customers: raw?.customers || [],
    total_due: Number(raw?.total_due) || 0,
    customers_with_due: Number(raw?.customers_with_due) || 0,
  };
}

/**
 * Fetches full details, bills, and payments for a specific credit customer.
 */
export async function udhaarCustomerDetail(
  customerId: string
): Promise<UdhaarCustomerDetail> {
  const { data, error } = await supabase.rpc("tapx_credit_customer_detail", {
    p_customer_id: customerId,
  });

  if (error) {
    throw new Error(formatUdhaarError(error));
  }

  return data as UdhaarCustomerDetail;
}

/**
 * Searches customers for autocomplete by name or phone digits.
 */
export async function udhaarFindCustomers(
  businessId: string,
  query?: string | null
): Promise<UdhaarCustomerSearchResult[]> {
  const { data, error } = await supabase.rpc("tapx_credit_find_customers", {
    p_business_id: businessId,
    p_query: query ? query.trim() : null,
  });

  if (error) {
    throw new Error(formatUdhaarError(error));
  }

  return (data as UdhaarCustomerSearchResult[]) || [];
}

/**
 * Creates or updates a credit customer.
 * When p_customer_id is null, it creates or returns the existing customer id if phone matches.
 */
export async function udhaarSaveCustomer(params: {
  businessId: string;
  customerId?: string | null;
  name: string;
  phone: string;
  creditLimit?: number | null;
  notes?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("tapx_credit_save_customer", {
    p_business_id: params.businessId,
    p_customer_id: params.customerId || null,
    p_name: params.name.trim(),
    p_phone: params.phone.trim(),
    p_credit_limit:
      typeof params.creditLimit === "number" && Number.isFinite(params.creditLimit)
        ? params.creditLimit
        : null,
    p_notes: params.notes ? params.notes.trim() : null,
  });

  if (error) {
    throw new Error(formatUdhaarError(error));
  }

  return String(data);
}

/**
 * Puts an issued, unpaid bill on customer credit.
 */
export async function udhaarPutBillOnCredit(
  billId: string,
  customerId: string,
  overrideLimit: boolean = false
): Promise<UdhaarPutBillOnCreditResult> {
  const { data, error } = await supabase.rpc("tapx_put_bill_on_credit", {
    p_bill_id: billId,
    p_customer_id: customerId,
    p_override_limit: overrideLimit,
  });

  if (error) {
    if (isUdhaarMissingError(error)) {
      throw new Error("Udhaar is not enabled on this account yet.");
    }
    // Do not format limit exceeded errors so caller can parse prefix
    throw new Error(error.message || "Could not put bill on credit.");
  }

  return data as UdhaarPutBillOnCreditResult;
}

/**
 * Receives payment from a customer. Applies money to oldest bills first.
 */
export async function udhaarReceivePayment(params: {
  customerId: string;
  amount: number;
  method: "cash" | "upi" | "card";
  note?: string | null;
}): Promise<UdhaarReceivePaymentResult> {
  const { data, error } = await supabase.rpc("tapx_credit_receive_payment", {
    p_customer_id: params.customerId,
    p_amount: params.amount,
    p_method: params.method,
    p_note: params.note ? params.note.trim() : null,
  });

  if (error) {
    throw new Error(formatUdhaarError(error));
  }

  return data as UdhaarReceivePaymentResult;
}

/**
 * Reverses a previously recorded payment and resets affected bills.
 */
export async function udhaarReversePayment(
  paymentId: string,
  reason: string
): Promise<void> {
  const { error } = await supabase.rpc("tapx_credit_reverse_payment", {
    p_payment_id: paymentId,
    p_reason: reason.trim(),
  });

  if (error) {
    throw new Error(formatUdhaarError(error));
  }
}

/**
 * Retrieves credit information for bills in chunks of max 500 ids.
 */
export async function udhaarBillInfo(
  businessId: string,
  billIds: string[]
): Promise<UdhaarBillInfo[]> {
  const validIds = Array.from(
    new Set(billIds.filter((id) => Boolean(id && typeof id === "string")))
  );
  if (!businessId || validIds.length === 0) return [];

  const CHUNK_SIZE = 500;
  const results: UdhaarBillInfo[] = [];

  for (let i = 0; i < validIds.length; i += CHUNK_SIZE) {
    const chunk = validIds.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase.rpc("tapx_credit_bill_info", {
      p_business_id: businessId,
      p_bill_ids: chunk,
    });

    if (error) {
      if (isUdhaarMissingError(error)) {
        return [];
      }
      throw new Error(formatUdhaarError(error));
    }

    if (Array.isArray(data)) {
      results.push(...(data as UdhaarBillInfo[]));
    }
  }

  return results;
}

/**
 * Builds a friendly WhatsApp statement message.
 */
export function buildUdhaarStatementMessage(params: {
  customerName?: string | null;
  businessName?: string | null;
  balance: number;
  bills: Pick<UdhaarBillItem, "bill_no_text" | "bill_day" | "due" | "share_token">[];
  origin?: string | null;
  upiId?: string | null;
}): string {
  const name = (params.customerName || "").trim();
  const biz = (params.businessName || "").trim();
  const openBills = (params.bills || []).filter((b) => (Number(b.due) || 0) > 0);
  const origin = (params.origin || "").replace(/\/+$/, "");
  const upi = (params.upiId || "").trim();

  const lines: string[] = [];
  lines.push(name ? `Hello ${name},` : "Hello,");
  lines.push(
    biz
      ? `This is a friendly reminder from ${biz}. Your udhaar balance is ${formatMoney(params.balance)}:`
      : `This is a friendly reminder. Your udhaar balance is ${formatMoney(params.balance)}:`
  );

  const shown = openBills.slice(0, 5);
  for (const b of shown) {
    const day = formatOrderDayShort(b.bill_day);
    lines.push(`• ${b.bill_no_text}${day ? ` (${day})` : ""}: ${formatMoney(b.due)}`);
    if (origin && b.share_token) {
      lines.push(`${origin}/bill/${b.share_token}`);
    }
  }

  if (openBills.length > shown.length) {
    const more = openBills.length - shown.length;
    lines.push(`+ ${more} more ${more === 1 ? "bill" : "bills"}`);
  }

  if (upi) {
    lines.push(`You can pay by UPI: ${upi}`);
  }

  lines.push("Thank you!");
  return lines.join("\n");
}

/**
 * Builds a friendly WhatsApp receipt message after receiving a payment.
 */
export function buildUdhaarReceiptMessage(params: {
  customerName?: string | null;
  businessName?: string | null;
  amount: number;
  method: string;
  balanceAfter: number;
}): string {
  const name = (params.customerName || "").trim();
  const biz = (params.businessName || "").trim();
  const methodUpper = params.method ? params.method.toUpperCase() : "PAYMENT";

  const lines: string[] = [];
  if (name && biz) {
    lines.push(`Hello ${name}, thank you for your payment to ${biz}.`);
  } else if (name) {
    lines.push(`Hello ${name}, thank you for your payment.`);
  } else if (biz) {
    lines.push(`Thank you for your payment to ${biz}.`);
  } else {
    lines.push("Thank you for your payment.");
  }

  lines.push(
    `Received ${formatMoney(params.amount)} by ${methodUpper}. Remaining balance: ${formatMoney(params.balanceAfter)}.`
  );
  lines.push("Thank you!");
  return lines.join("\n");
}
