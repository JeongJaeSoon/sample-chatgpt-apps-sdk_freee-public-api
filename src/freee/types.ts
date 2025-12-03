/**
 * freee API Type Definitions
 * Based on freee API Reference
 */

// Common types
export interface Meta {
  total_count: number;
}

// Company (事業所)
export interface Company {
  id: number;
  name: string;
  name_kana: string;
  display_name: string;
  role: 'admin' | 'simple_accounting' | 'self_only' | 'read_only';
}

export interface CompanyResponse {
  company: Company;
}

export interface CompaniesResponse {
  companies: Company[];
}

// Partner (取引先)
export interface Partner {
  id: number;
  company_id: number;
  name: string;
  code: string | null;
  shortcut1: string | null;
  shortcut2: string | null;
  long_name: string | null;
  name_kana: string | null;
  default_title: string | null;
  phone: string | null;
  contact_name: string | null;
  email: string | null;
  address_attributes: {
    zipcode: string | null;
    prefecture_code: number | null;
    street_name1: string | null;
    street_name2: string | null;
  };
  partner_doc_setting_attributes: {
    sending_method: 'email' | 'posting' | 'main_and_sub' | null;
  };
  partner_bank_account_attributes: {
    bank_name: string | null;
    bank_name_kana: string | null;
    bank_code: string | null;
    branch_name: string | null;
    branch_kana: string | null;
    branch_code: string | null;
    account_type: 'ordinary' | 'checking' | 'earmarked' | 'savings' | 'other' | null;
    account_number: string | null;
    account_name: string | null;
    long_account_name: string | null;
  };
  available: boolean;
}

export interface PartnersResponse {
  partners: Partner[];
  meta?: Meta;
}

export interface PartnerResponse {
  partner: Partner;
}

// Invoice (請求書)
export interface InvoiceLine {
  id?: number;
  type: 'normal' | 'discount' | 'text';
  qty: number;
  unit: string;
  unit_price: number;
  vat: number;
  description: string;
  tax_code: number;
  account_item_id: number;
  account_item_name?: string;
  amount?: number;
}

export interface Invoice {
  id: number;
  company_id: number;
  issue_date: string;
  partner_id: number;
  partner_code: string | null;
  partner_name: string;
  invoice_number: string;
  title: string;
  due_date: string | null;
  total_amount: number;
  total_vat: number;
  sub_total: number;
  booking_date: string | null;
  description: string | null;
  invoice_status: 'draft' | 'applying' | 'remanded' | 'rejected' | 'approved' | 'issued' | 'unsubmitted';
  payment_status: 'empty' | 'unsettled' | 'settled';
  payment_date: string | null;
  web_published_at: string | null;
  web_downloaded_at: string | null;
  web_confirmed_at: string | null;
  mail_sent_at: string | null;
  posting_status: 'unrequested' | 'preview_registered' | 'preview_failed' | 'ordered' | 'order_failed' | 'printing' | 'canceled' | 'posted';
  partner_display_name: string;
  partner_title: string;
  partner_zipcode: string | null;
  partner_prefecture_code: number | null;
  partner_prefecture_name: string | null;
  partner_address1: string | null;
  partner_address2: string | null;
  partner_contact_info: string | null;
  company_name: string;
  company_zipcode: string | null;
  company_prefecture_code: number | null;
  company_prefecture_name: string | null;
  company_address1: string | null;
  company_address2: string | null;
  company_contact_info: string | null;
  payment_type: 'transfer' | 'direct_debit';
  payment_bank_info: string | null;
  message: string | null;
  notes: string | null;
  invoice_layout: 'default_classic' | 'standard_classic' | 'envelope_classic' | 'default_modern' | 'standard_modern' | 'envelope_modern';
  tax_entry_method: 'inclusive' | 'exclusive';
  deal_id: number | null;
  invoice_contents: InvoiceLine[];
  total_amount_per_vat_rate: {
    vat_5: number;
    vat_8: number;
    reduced_vat_8: number;
    vat_10: number;
    reduced_vat_10: number;
  };
}

export interface InvoicesResponse {
  invoices: Invoice[];
  meta?: Meta;
}

export interface InvoiceResponse {
  invoice: Invoice;
}

export interface CreateInvoiceParams {
  company_id: number;
  issue_date: string;
  partner_id?: number;
  partner_code?: string;
  invoice_number?: string;
  title?: string;
  due_date?: string;
  booking_date?: string;
  description?: string;
  invoice_status?: 'draft' | 'issue';
  partner_display_name?: string;
  partner_title?: string;
  partner_contact_info?: string;
  partner_zipcode?: string;
  partner_prefecture_code?: number;
  partner_address1?: string;
  partner_address2?: string;
  company_name?: string;
  company_zipcode?: string;
  company_prefecture_code?: number;
  company_address1?: string;
  company_address2?: string;
  company_contact_info?: string;
  payment_type?: 'transfer' | 'direct_debit';
  payment_bank_info?: string;
  use_virtual_transfer_account?: 'not_use' | 'use';
  message?: string;
  notes?: string;
  invoice_layout?: 'default_classic' | 'standard_classic' | 'envelope_classic' | 'default_modern' | 'standard_modern' | 'envelope_modern';
  tax_entry_method?: 'inclusive' | 'exclusive';
  invoice_contents: Array<{
    order: number;
    type: 'normal' | 'discount' | 'text';
    qty: number;
    unit: string;
    unit_price: number;
    vat?: number;
    description?: string;
    tax_code: number;
    account_item_id?: number;
  }>;
}

// Account Item (勘定科目)
export interface AccountItem {
  id: number;
  name: string;
  shortcut: string | null;
  shortcut_num: string | null;
  default_tax_code: number;
  categories: string[];
  available: boolean;
  walletable_id: number | null;
  group_name: string;
  corresponding_income_name: string | null;
  corresponding_expense_name: string | null;
}

export interface AccountItemsResponse {
  account_items: AccountItem[];
  meta?: Meta;
}

// Tax Code (税区分)
export interface TaxCode {
  code: number;
  name: string;
  name_ja: string;
}

export interface TaxCodesResponse {
  taxes: TaxCode[];
}

// User
export interface User {
  id: number;
  email: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  first_name_kana: string | null;
  last_name_kana: string | null;
}

export interface UsersResponse {
  users: User[];
}

export interface UsersMeResponse {
  user: User & {
    companies: Array<{
      id: number;
      display_name: string;
      role: string;
      use_custom_role: boolean;
    }>;
  };
}
