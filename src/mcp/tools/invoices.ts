import { FreeeClient } from '../../freee/client';
import {
  Invoice,
  InvoicesResponse,
  InvoiceResponse,
  CreateInvoiceParams,
} from '../../freee/types';

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

export const invoiceTools: Tool[] = [
  {
    name: 'freee_list_invoices',
    description: '請求書の一覧を取得します。ステータスや取引先でフィルタリングできます。',
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
        invoice_status: {
          type: 'string',
          enum: ['draft', 'applying', 'remanded', 'rejected', 'approved', 'issued', 'unsubmitted'],
          description: '請求書のステータスでフィルタリング',
        },
        payment_status: {
          type: 'string',
          enum: ['empty', 'unsettled', 'settled'],
          description: '入金ステータスでフィルタリング',
        },
        start_issue_date: {
          type: 'string',
          description: '発行日の範囲開始（YYYY-MM-DD形式）',
        },
        end_issue_date: {
          type: 'string',
          description: '発行日の範囲終了（YYYY-MM-DD形式）',
        },
        start_due_date: {
          type: 'string',
          description: '支払期日の範囲開始（YYYY-MM-DD形式）',
        },
        end_due_date: {
          type: 'string',
          description: '支払期日の範囲終了（YYYY-MM-DD形式）',
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

      // Add optional filters
      if (args.partner_id) params.partner_id = args.partner_id as number;
      if (args.invoice_status) params.invoice_status = args.invoice_status as string;
      if (args.payment_status) params.payment_status = args.payment_status as string;
      if (args.start_issue_date) params.start_issue_date = args.start_issue_date as string;
      if (args.end_issue_date) params.end_issue_date = args.end_issue_date as string;
      if (args.start_due_date) params.start_due_date = args.start_due_date as string;
      if (args.end_due_date) params.end_due_date = args.end_due_date as string;
      if (args.offset !== undefined) params.offset = args.offset as number;
      if (args.limit !== undefined) params.limit = args.limit as number;

      const response = await client.get<InvoicesResponse>('/api/1/invoices', params);
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
      const response = await client.get<InvoiceResponse>(`/api/1/invoices/${invoiceId}`, {
        company_id: companyId,
      });
      return formatInvoiceDetail(response.invoice);
    },
  },

  {
    name: 'freee_create_invoice',
    description: '新しい請求書を作成します。',
    inputSchema: {
      type: 'object',
      properties: {
        company_id: {
          type: 'number',
          description: '事業所ID（必須）',
        },
        issue_date: {
          type: 'string',
          description: '発行日（YYYY-MM-DD形式、必須）',
        },
        partner_id: {
          type: 'number',
          description: '取引先ID',
        },
        partner_name: {
          type: 'string',
          description: '取引先名（partner_idを指定しない場合に使用）',
        },
        title: {
          type: 'string',
          description: '件名',
        },
        due_date: {
          type: 'string',
          description: '支払期日（YYYY-MM-DD形式）',
        },
        description: {
          type: 'string',
          description: '概要',
        },
        invoice_status: {
          type: 'string',
          enum: ['draft', 'issue'],
          description: '請求書ステータス（draft: 下書き, issue: 発行）',
        },
        tax_entry_method: {
          type: 'string',
          enum: ['inclusive', 'exclusive'],
          description: '税込/税抜（inclusive: 内税, exclusive: 外税）',
        },
        lines: {
          type: 'array',
          description: '請求書の明細行',
          items: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: '品目名',
              },
              qty: {
                type: 'number',
                description: '数量',
              },
              unit: {
                type: 'string',
                description: '単位',
              },
              unit_price: {
                type: 'number',
                description: '単価',
              },
              tax_code: {
                type: 'number',
                description: '税区分コード（21: 課税売上10%, 22: 課税売上8%軽減など）',
              },
            },
          },
        },
      },
      required: ['company_id', 'issue_date', 'lines'],
    },
    handler: async (client, companyId, args) => {
      const lines = (args.lines as Array<{
        description?: string;
        qty: number;
        unit?: string;
        unit_price: number;
        tax_code: number;
      }>).map((line, index) => ({
        order: index + 1,
        type: 'normal' as const,
        qty: line.qty,
        unit: line.unit || '',
        unit_price: line.unit_price,
        description: line.description || '',
        tax_code: line.tax_code,
      }));

      const invoiceParams: CreateInvoiceParams = {
        company_id: companyId,
        issue_date: args.issue_date as string,
        invoice_contents: lines,
      };

      // Add optional fields
      if (args.partner_id) invoiceParams.partner_id = args.partner_id as number;
      if (args.partner_name) invoiceParams.partner_display_name = args.partner_name as string;
      if (args.title) invoiceParams.title = args.title as string;
      if (args.due_date) invoiceParams.due_date = args.due_date as string;
      if (args.description) invoiceParams.description = args.description as string;
      if (args.invoice_status) invoiceParams.invoice_status = args.invoice_status as 'draft' | 'issue';
      if (args.tax_entry_method) invoiceParams.tax_entry_method = args.tax_entry_method as 'inclusive' | 'exclusive';

      const response = await client.post<InvoiceResponse>('/api/1/invoices', invoiceParams);
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
        issue_date: {
          type: 'string',
          description: '発行日（YYYY-MM-DD形式）',
        },
        title: {
          type: 'string',
          description: '件名',
        },
        due_date: {
          type: 'string',
          description: '支払期日（YYYY-MM-DD形式）',
        },
        description: {
          type: 'string',
          description: '概要',
        },
        invoice_status: {
          type: 'string',
          enum: ['draft', 'issue'],
          description: '請求書ステータス',
        },
      },
      required: ['company_id', 'id'],
    },
    handler: async (client, companyId, args) => {
      const invoiceId = args.id as number;

      const updateParams: Record<string, unknown> = {
        company_id: companyId,
      };

      if (args.issue_date) updateParams.issue_date = args.issue_date;
      if (args.title) updateParams.title = args.title;
      if (args.due_date) updateParams.due_date = args.due_date;
      if (args.description) updateParams.description = args.description;
      if (args.invoice_status) updateParams.invoice_status = args.invoice_status;

      const response = await client.put<InvoiceResponse>(`/api/1/invoices/${invoiceId}`, updateParams);
      return {
        message: '請求書を更新しました',
        invoice: formatInvoiceDetail(response.invoice),
      };
    },
  },

  {
    name: 'freee_delete_invoice',
    description: '請求書を削除します（下書き状態のみ削除可能）。',
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
      await client.delete(`/api/1/invoices/${invoiceId}`, {
        company_id: companyId,
      });
      return {
        message: `請求書 (ID: ${invoiceId}) を削除しました`,
      };
    },
  },
];

// Helper functions to format invoice data
function formatInvoiceSummary(invoice: Invoice) {
  return {
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    issue_date: invoice.issue_date,
    partner_name: invoice.partner_name,
    title: invoice.title,
    total_amount: invoice.total_amount,
    invoice_status: translateInvoiceStatus(invoice.invoice_status),
    payment_status: translatePaymentStatus(invoice.payment_status),
    due_date: invoice.due_date,
  };
}

function formatInvoiceDetail(invoice: Invoice) {
  return {
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    issue_date: invoice.issue_date,
    partner_name: invoice.partner_name,
    partner_display_name: invoice.partner_display_name,
    title: invoice.title,
    description: invoice.description,
    total_amount: invoice.total_amount,
    sub_total: invoice.sub_total,
    total_vat: invoice.total_vat,
    invoice_status: translateInvoiceStatus(invoice.invoice_status),
    payment_status: translatePaymentStatus(invoice.payment_status),
    due_date: invoice.due_date,
    payment_date: invoice.payment_date,
    lines: invoice.invoice_contents.map(line => ({
      type: line.type,
      description: line.description,
      qty: line.qty,
      unit: line.unit,
      unit_price: line.unit_price,
      amount: line.amount,
      vat: line.vat,
    })),
    company_name: invoice.company_name,
    message: invoice.message,
    notes: invoice.notes,
  };
}

function translateInvoiceStatus(status: string): string {
  const statusMap: Record<string, string> = {
    draft: '下書き',
    applying: '申請中',
    remanded: '差戻し',
    rejected: '却下',
    approved: '承認済み',
    issued: '発行済み',
    unsubmitted: '未提出',
  };
  return statusMap[status] || status;
}

function translatePaymentStatus(status: string): string {
  const statusMap: Record<string, string> = {
    empty: '未設定',
    unsettled: '未入金',
    settled: '入金済み',
  };
  return statusMap[status] || status;
}
