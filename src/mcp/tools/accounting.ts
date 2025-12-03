import { FreeeClient } from '../../freee/client';
import {
  CompaniesResponse,
  CompanyResponse,
  PartnersResponse,
  PartnerResponse,
  AccountItemsResponse,
  TaxCodesResponse,
  UsersMeResponse,
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

export const accountingTools: Tool[] = [
  {
    name: 'freee_get_me',
    description: '現在のユーザー情報と所属事業所の一覧を取得します。',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: async (client, _companyId, _args) => {
      const response = await client.get<UsersMeResponse>('/api/1/users/me', {
        companies: true,
      });

      return {
        user: {
          id: response.user.id,
          email: response.user.email,
          display_name: response.user.display_name,
          first_name: response.user.first_name,
          last_name: response.user.last_name,
        },
        companies: response.user.companies.map(c => ({
          id: c.id,
          display_name: c.display_name,
          role: c.role,
        })),
      };
    },
  },

  {
    name: 'freee_get_company',
    description: '事業所の詳細情報を取得します。',
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
      const response = await client.get<CompanyResponse>(`/api/1/companies/${companyId}`);
      const company = response.company;

      return {
        id: company.id,
        name: company.name,
        display_name: company.display_name,
        role: translateRole(company.role),
      };
    },
  },

  {
    name: 'freee_list_partners',
    description: '取引先の一覧を取得します。',
    inputSchema: {
      type: 'object',
      properties: {
        company_id: {
          type: 'number',
          description: '事業所ID（必須）',
        },
        keyword: {
          type: 'string',
          description: '検索キーワード（取引先名、コードなどで検索）',
        },
        offset: {
          type: 'number',
          description: '取得開始位置（0から始まる）',
        },
        limit: {
          type: 'number',
          description: '取得件数（最大3000）',
        },
      },
      required: ['company_id'],
    },
    handler: async (client, companyId, args) => {
      const params: Record<string, string | number | boolean | undefined> = {
        company_id: companyId,
      };

      if (args.keyword) params.keyword = args.keyword as string;
      if (args.offset !== undefined) params.offset = args.offset as number;
      if (args.limit !== undefined) params.limit = args.limit as number;

      const response = await client.get<PartnersResponse>('/api/1/partners', params);

      return {
        partners: response.partners.map(p => ({
          id: p.id,
          name: p.name,
          code: p.code,
          shortcut1: p.shortcut1,
          email: p.email,
          phone: p.phone,
          available: p.available,
        })),
        total_count: response.meta?.total_count,
      };
    },
  },

  {
    name: 'freee_get_partner',
    description: '取引先の詳細情報を取得します。',
    inputSchema: {
      type: 'object',
      properties: {
        company_id: {
          type: 'number',
          description: '事業所ID（必須）',
        },
        id: {
          type: 'number',
          description: '取引先ID（必須）',
        },
      },
      required: ['company_id', 'id'],
    },
    handler: async (client, companyId, args) => {
      const partnerId = args.id as number;
      const response = await client.get<PartnerResponse>(`/api/1/partners/${partnerId}`, {
        company_id: companyId,
      });
      const p = response.partner;

      return {
        id: p.id,
        name: p.name,
        code: p.code,
        long_name: p.long_name,
        email: p.email,
        phone: p.phone,
        contact_name: p.contact_name,
        address: {
          zipcode: p.address_attributes.zipcode,
          prefecture_code: p.address_attributes.prefecture_code,
          street_name1: p.address_attributes.street_name1,
          street_name2: p.address_attributes.street_name2,
        },
        available: p.available,
      };
    },
  },

  {
    name: 'freee_list_account_items',
    description: '勘定科目の一覧を取得します。',
    inputSchema: {
      type: 'object',
      properties: {
        company_id: {
          type: 'number',
          description: '事業所ID（必須）',
        },
        base_date: {
          type: 'string',
          description: '基準日（YYYY-MM-DD形式）',
        },
      },
      required: ['company_id'],
    },
    handler: async (client, companyId, args) => {
      const params: Record<string, string | number | boolean | undefined> = {
        company_id: companyId,
      };

      if (args.base_date) params.base_date = args.base_date as string;

      const response = await client.get<AccountItemsResponse>('/api/1/account_items', params);

      return {
        account_items: response.account_items.map(item => ({
          id: item.id,
          name: item.name,
          shortcut: item.shortcut,
          group_name: item.group_name,
          categories: item.categories,
          default_tax_code: item.default_tax_code,
          available: item.available,
        })),
        total_count: response.meta?.total_count,
      };
    },
  },

  {
    name: 'freee_list_tax_codes',
    description: '税区分の一覧を取得します。',
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
      const response = await client.get<TaxCodesResponse>('/api/1/taxes/codes', {
        company_id: companyId,
      });

      return {
        tax_codes: response.taxes.map(tax => ({
          code: tax.code,
          name: tax.name,
          name_ja: tax.name_ja,
        })),
      };
    },
  },

  {
    name: 'freee_create_partner',
    description: '新しい取引先を作成します。',
    inputSchema: {
      type: 'object',
      properties: {
        company_id: {
          type: 'number',
          description: '事業所ID（必須）',
        },
        name: {
          type: 'string',
          description: '取引先名（必須）',
        },
        code: {
          type: 'string',
          description: '取引先コード',
        },
        shortcut1: {
          type: 'string',
          description: 'ショートカット1',
        },
        shortcut2: {
          type: 'string',
          description: 'ショートカット2',
        },
        long_name: {
          type: 'string',
          description: '正式名称',
        },
        email: {
          type: 'string',
          description: 'メールアドレス',
        },
        phone: {
          type: 'string',
          description: '電話番号',
        },
        contact_name: {
          type: 'string',
          description: '担当者名',
        },
        zipcode: {
          type: 'string',
          description: '郵便番号',
        },
        prefecture_code: {
          type: 'number',
          description: '都道府県コード（1-47）',
        },
        street_name1: {
          type: 'string',
          description: '市区町村・番地',
        },
        street_name2: {
          type: 'string',
          description: '建物名・部屋番号',
        },
      },
      required: ['company_id', 'name'],
    },
    handler: async (client, companyId, args) => {
      const partnerParams: Record<string, unknown> = {
        company_id: companyId,
        name: args.name,
      };

      if (args.code) partnerParams.code = args.code;
      if (args.shortcut1) partnerParams.shortcut1 = args.shortcut1;
      if (args.shortcut2) partnerParams.shortcut2 = args.shortcut2;
      if (args.long_name) partnerParams.long_name = args.long_name;
      if (args.email) partnerParams.email = args.email;
      if (args.phone) partnerParams.phone = args.phone;
      if (args.contact_name) partnerParams.contact_name = args.contact_name;

      // Address attributes
      const addressAttributes: Record<string, unknown> = {};
      if (args.zipcode) addressAttributes.zipcode = args.zipcode;
      if (args.prefecture_code) addressAttributes.prefecture_code = args.prefecture_code;
      if (args.street_name1) addressAttributes.street_name1 = args.street_name1;
      if (args.street_name2) addressAttributes.street_name2 = args.street_name2;

      if (Object.keys(addressAttributes).length > 0) {
        partnerParams.address_attributes = addressAttributes;
      }

      const response = await client.post<PartnerResponse>('/api/1/partners', partnerParams);

      return {
        message: '取引先を作成しました',
        partner: {
          id: response.partner.id,
          name: response.partner.name,
          code: response.partner.code,
        },
      };
    },
  },
];

function translateRole(role: string): string {
  const roleMap: Record<string, string> = {
    admin: '管理者',
    simple_accounting: '一般（経理担当）',
    self_only: '一般（自分の経費のみ）',
    read_only: '閲覧のみ',
  };
  return roleMap[role] || role;
}
