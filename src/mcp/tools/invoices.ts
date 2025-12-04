import { FreeeClient } from '../../freee/client';

interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (client: FreeeClient, companyId: number, args: Record<string, unknown>) => Promise<unknown>;
}

// Response types for Invoice API (iv/api/v1)
interface InvoiceApiInvoice {
  id: number;
  company_id: number;
  invoice_number: string;
  billing_date: string;
  payment_date: string | null;
  payment_type: string;
  subject: string | null;
  total_amount: number;
  total_vat: number;
  sub_total: number;
  partner_id: number | null;
  partner_name: string | null;
  partner_title: string;
  tax_entry_method: string;
  lines: Array<{
    id: number;
    type: string;
    description: string;
    quantity: number | null;
    unit: string | null;
    unit_price: number | null;
    amount: number | null;
    tax_rate: number | null;
  }>;
  status: string;
  created_at: string;
  updated_at: string;
}

interface InvoiceApiListResponse {
  invoices: InvoiceApiInvoice[];
  meta?: {
    total_count: number;
  };
}

interface InvoiceApiResponse {
  invoice: InvoiceApiInvoice;
}

interface InvoiceTemplatesResponse {
  invoice_templates: Array<{
    id: number;
    name: string;
  }>;
}

export const invoiceTools: Tool[] = [
  {
    name: 'freee_list_invoice_templates',
    description: '使用可能な請求書テンプレート一覧を取得します。請求書作成時にtemplate_idが必要な場合に使用します。',
    inputSchema: {
      type: 'object',
      properties: {
        company_id: {
          type: 'number',
          description: '事業所ID（必須）',
        },
      },
      required: ['company_id'],
    },
    handler: async (client, companyId, _args) => {
      const response = await client.invoiceGet<InvoiceTemplatesResponse>('/invoices/templates', {
        company_id: companyId,
      });
      return {
        templates: response.invoice_templates,
      };
    },
  },

  {
    name: 'freee_list_invoices',
    description: '請求書の一覧を取得します。',
    inputSchema: {
      type: 'object',
      properties: {
        company_id: {
          type: 'number',
          description: '事業所ID（必須）',
        },
        partner_id: {
          type: 'number',
          description: '取引先IDでフィルタリング',
        },
        start_billing_date: {
          type: 'string',
          description: '請求日の範囲開始（YYYY-MM-DD形式）',
        },
        end_billing_date: {
          type: 'string',
          description: '請求日の範囲終了（YYYY-MM-DD形式）',
        },
        offset: {
          type: 'number',
          description: '取得開始位置（0から始まる）',
        },
        limit: {
          type: 'number',
          description: '取得件数（最大100）',
        },
      },
      required: ['company_id'],
    },
    handler: async (client, companyId, args) => {
      const params: Record<string, string | number | boolean | undefined> = {
        company_id: companyId,
      };

      if (args.partner_id) params.partner_id = args.partner_id as number;
      if (args.start_billing_date) params.start_billing_date = args.start_billing_date as string;
      if (args.end_billing_date) params.end_billing_date = args.end_billing_date as string;
      if (args.offset !== undefined) params.offset = args.offset as number;
      if (args.limit !== undefined) params.limit = args.limit as number;

      const response = await client.invoiceGet<InvoiceApiListResponse>('/invoices', params);
      return {
        invoices: response.invoices.map(formatInvoiceSummary),
        total_count: response.meta?.total_count,
      };
    },
  },

  {
    name: 'freee_get_invoice',
    description: '請求書の詳細を取得します。',
    inputSchema: {
      type: 'object',
      properties: {
        company_id: {
          type: 'number',
          description: '事業所ID（必須）',
        },
        id: {
          type: 'number',
          description: '請求書ID（必須）',
        },
      },
      required: ['company_id', 'id'],
    },
    handler: async (client, companyId, args) => {
      const invoiceId = args.id as number;
      const response = await client.invoiceGet<InvoiceApiResponse>(`/invoices/${invoiceId}`, {
        company_id: companyId,
      });
      return formatInvoiceDetail(response.invoice);
    },
  },

  {
    name: 'freee_create_invoice',
    description: '新しい請求書を作成します。事前にfreee_list_invoice_templatesでテンプレートIDを取得してください。',
    inputSchema: {
      type: 'object',
      properties: {
        company_id: {
          type: 'number',
          description: '事業所ID（必須）',
        },
        billing_date: {
          type: 'string',
          description: '請求日（YYYY-MM-DD形式、必須）',
        },
        partner_id: {
          type: 'number',
          description: '取引先ID（partner_idまたはpartner_codeのいずれかが必須）',
        },
        partner_code: {
          type: 'string',
          description: '取引先コード（partner_idまたはpartner_codeのいずれかが必須）',
        },
        template_id: {
          type: 'number',
          description: '帳票テンプレートID（省略時は事業所のデフォルト）',
        },
        invoice_number: {
          type: 'string',
          description: '請求書番号（自動採番設定によっては必須）',
        },
        payment_date: {
          type: 'string',
          description: '支払期日（YYYY-MM-DD形式）',
        },
        payment_type: {
          type: 'string',
          enum: ['transfer', 'direct_debit'],
          description: '入金方法（transfer: 振込, direct_debit: 口座振替）',
        },
        subject: {
          type: 'string',
          description: '件名',
        },
        tax_entry_method: {
          type: 'string',
          enum: ['in', 'out'],
          description: '消費税内税/外税（in: 内税, out: 外税、必須）',
        },
        tax_fraction: {
          type: 'string',
          enum: ['omit', 'round_up', 'round'],
          description: '消費税端数計算方法（omit: 切り捨て, round_up: 切り上げ, round: 四捨五入、必須）',
        },
        withholding_tax_entry_method: {
          type: 'string',
          enum: ['in', 'out'],
          description: '源泉徴収計算方法（in: 税込, out: 税抜、必須）',
        },
        partner_title: {
          type: 'string',
          enum: ['御中', '様', ''],
          description: '敬称（必須）',
        },
        lines: {
          type: 'array',
          description: '請求書の明細行（必須）',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['item', 'text'],
                description: '行タイプ（item: 品目, text: テキスト）',
              },
              description: {
                type: 'string',
                description: '品名（必須）',
              },
              quantity: {
                type: 'number',
                description: '数量（品目行では必須）',
              },
              unit: {
                type: 'string',
                description: '単位',
              },
              unit_price: {
                type: 'number',
                description: '単価',
              },
              tax_rate: {
                type: 'number',
                enum: [0, 8, 10],
                description: '税率（0, 8, 10のいずれか）',
              },
            },
          },
        },
      },
      required: ['company_id', 'billing_date', 'tax_entry_method', 'tax_fraction', 'withholding_tax_entry_method', 'partner_title', 'lines'],
    },
    handler: async (client, companyId, args) => {
      const lines = (args.lines as Array<{
        type?: string;
        description: string;
        quantity?: number;
        unit?: string;
        unit_price?: number;
        tax_rate?: number;
      }>).map((line) => ({
        type: line.type || 'item',
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unit_price: line.unit_price,
        tax_rate: line.tax_rate,
      }));

      const invoiceParams: Record<string, unknown> = {
        company_id: companyId,
        billing_date: args.billing_date,
        tax_entry_method: args.tax_entry_method,
        tax_fraction: args.tax_fraction,
        withholding_tax_entry_method: args.withholding_tax_entry_method,
        partner_title: args.partner_title,
        lines: lines,
      };

      // Add optional fields
      if (args.partner_id) invoiceParams.partner_id = args.partner_id;
      if (args.partner_code) invoiceParams.partner_code = args.partner_code;
      if (args.template_id) invoiceParams.template_id = args.template_id;
      if (args.invoice_number) invoiceParams.invoice_number = args.invoice_number;
      if (args.payment_date) invoiceParams.payment_date = args.payment_date;
      if (args.payment_type) invoiceParams.payment_type = args.payment_type;
      if (args.subject) invoiceParams.subject = args.subject;

      const response = await client.invoicePost<InvoiceApiResponse>('/invoices', invoiceParams);
      return {
        message: '請求書を作成しました',
        invoice: formatInvoiceDetail(response.invoice),
      };
    },
  },

  {
    name: 'freee_update_invoice',
    description: '既存の請求書を更新します。',
    inputSchema: {
      type: 'object',
      properties: {
        company_id: {
          type: 'number',
          description: '事業所ID（必須）',
        },
        id: {
          type: 'number',
          description: '請求書ID（必須）',
        },
        billing_date: {
          type: 'string',
          description: '請求日（YYYY-MM-DD形式）',
        },
        payment_date: {
          type: 'string',
          description: '支払期日（YYYY-MM-DD形式）',
        },
        subject: {
          type: 'string',
          description: '件名',
        },
      },
      required: ['company_id', 'id'],
    },
    handler: async (client, companyId, args) => {
      const invoiceId = args.id as number;

      const updateParams: Record<string, unknown> = {
        company_id: companyId,
      };

      if (args.billing_date) updateParams.billing_date = args.billing_date;
      if (args.payment_date) updateParams.payment_date = args.payment_date;
      if (args.subject) updateParams.subject = args.subject;

      const response = await client.invoicePut<InvoiceApiResponse>(`/invoices/${invoiceId}`, updateParams);
      return {
        message: '請求書を更新しました',
        invoice: formatInvoiceDetail(response.invoice),
      };
    },
  },

  {
    name: 'freee_delete_invoice',
    description: '請求書を削除します。',
    inputSchema: {
      type: 'object',
      properties: {
        company_id: {
          type: 'number',
          description: '事業所ID（必須）',
        },
        id: {
          type: 'number',
          description: '請求書ID（必須）',
        },
      },
      required: ['company_id', 'id'],
    },
    handler: async (client, companyId, args) => {
      const invoiceId = args.id as number;
      await client.invoiceDelete(`/invoices/${invoiceId}`, {
        company_id: companyId,
      });
      return {
        message: `請求書 (ID: ${invoiceId}) を削除しました`,
      };
    },
  },
];

// Helper functions
function formatInvoiceSummary(invoice: InvoiceApiInvoice) {
  return {
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    billing_date: invoice.billing_date,
    partner_name: invoice.partner_name,
    subject: invoice.subject,
    total_amount: invoice.total_amount,
    status: invoice.status,
    payment_date: invoice.payment_date,
  };
}

function formatInvoiceDetail(invoice: InvoiceApiInvoice) {
  return {
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    billing_date: invoice.billing_date,
    partner_id: invoice.partner_id,
    partner_name: invoice.partner_name,
    partner_title: invoice.partner_title,
    subject: invoice.subject,
    total_amount: invoice.total_amount,
    sub_total: invoice.sub_total,
    total_vat: invoice.total_vat,
    tax_entry_method: invoice.tax_entry_method,
    payment_type: invoice.payment_type,
    payment_date: invoice.payment_date,
    status: invoice.status,
    lines: invoice.lines.map(line => ({
      id: line.id,
      type: line.type,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unit_price: line.unit_price,
      amount: line.amount,
      tax_rate: line.tax_rate,
    })),
    created_at: invoice.created_at,
    updated_at: invoice.updated_at,
  };
}
