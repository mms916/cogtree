import cors from '@fastify/cors'
import Fastify from 'fastify'
import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import { z } from 'zod'

import { config } from './config.js'
import { pool, query } from './lib/pg.js'
import { ok } from './lib/response.js'
import { demoUser } from './modules/demo-data.js'

const demoBookIds = [
  'bc858d59-e1cc-4c07-95f7-6c4b7f395002',
  'bc858d59-e1cc-4c07-95f7-6c4b7f395001',
  'bc858d59-e1cc-4c07-95f7-6c4b7f395003',
]

const demoGroupIds = [
  '4fa58d59-e1cc-4c07-95f7-6c4b7f395101',
  '4fa58d59-e1cc-4c07-95f7-6c4b7f395102',
  '4fa58d59-e1cc-4c07-95f7-6c4b7f395103',
]

const demoQuoteIds = [
  '7d40b6f6-7817-40cf-a97a-1eb2cb5f9001',
  '7d40b6f6-7817-40cf-a97a-1eb2cb5f9002',
  '7d40b6f6-7817-40cf-a97a-1eb2cb5f9003',
  '7d40b6f6-7817-40cf-a97a-1eb2cb5f9004',
  '7d40b6f6-7817-40cf-a97a-1eb2cb5f9005',
]

const groupCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
})

const groupUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80),
})

const bookCreateSchema = z.object({
  groupId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  author: z.string().trim().max(120).optional(),
})

const bookUpdateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  author: z.string().trim().max(120).optional(),
  coverUrl: z.string().nullable().optional(),
})

const importedQuoteCardSchema = z.object({
  id: z.string(),
  text: z.string(),
  page: z.string().optional(),
  treeTitle: z.string().optional(),
  nodeCount: z.number().int().optional(),
})

const nodeNoteSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  contentHtml: z.string().optional(),
  createdAt: z.number(),
})

const nodeKnowledgeTagSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['quote', 'reflection', 'inspiration', 'case', 'question', 'action', 'custom']),
  type: z.enum(['system', 'custom']),
  systemKey: z.literal('quote').optional(),
  isFixed: z.boolean(),
  color: z.string(),
  sortOrder: z.number().int(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const nodeKnowledgeItemSchema = z.object({
  id: z.string(),
  tagId: z.string(),
  contentType: z.enum(['quote', 'reflection', 'inspiration', 'case', 'question', 'action', 'custom']),
  title: z.string(),
  content: z.string(),
  contentHtml: z.string().optional(),
  plainText: z.string().optional(),
  summary: z.string().optional(),
  sourceBookName: z.string().optional(),
  sourcePage: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['todo', 'active', 'done', 'paused']).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  progress: z.number().optional(),
  dueDate: z.string().optional(),
  imageSrc: z.string().optional(),
  imageAlt: z.string().optional(),
  chain: z.array(z.string()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const nodeMetaSchema = z.object({
  notes: z.array(nodeNoteSchema).optional(),
  knowledgeTags: z.array(nodeKnowledgeTagSchema).optional(),
  knowledgeItems: z.array(nodeKnowledgeItemSchema).optional(),
}).catchall(z.unknown())

const bookTreeNodeSchema = z.object({
  id: z.string(),
  label: z.string().trim().min(1).max(200),
  parentId: z.string().nullable(),
  childrenIds: z.array(z.string()),
  orderIndex: z.number().int(),
  nodeType: z.enum(['concept', 'cause', 'effect', 'abstract', 'pending']),
  status: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  meta: nodeMetaSchema.optional(),
  shortDefinition: z.string().optional().nullable(),
})

const bookTreeSaveSchema = z.object({
  bookId: z.string().uuid(),
  rootNodeIds: z.array(z.string()),
  nodes: z.record(z.string(), bookTreeNodeSchema),
  meta: z.object({
    importedQuoteIds: z.array(z.string()).optional(),
    importedCards: z.array(importedQuoteCardSchema).optional(),
    queueTrayMinimized: z.boolean().optional(),
    importedPocketOpen: z.boolean().optional(),
  }).optional(),
})

const bookTreeCommandSchema = z.object({
  commandName: z.enum([
    'create_node',
    'create_sibling_node',
    'rename_node',
    'delete_node',
    'move_node_as_child',
    'move_node_as_sibling',
    'toggle_node_collapsed',
    'update_node_notes',
    'update_node_meta',
    'import_quote_snapshot',
  ]),
  targetId: z.string().nullable().optional(),
  targetType: z.enum(['book_tree', 'book_node', 'quote_card']).optional(),
  clientVersion: z.number().int().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  snapshot: bookTreeSaveSchema,
})

const themeTreeNodeSchema = z.object({
  id: z.string(),
  label: z.string().trim().min(1).max(200),
  parentId: z.string().nullable(),
  childrenIds: z.array(z.string()),
  orderIndex: z.number().int(),
  nodeType: z.enum(['concept', 'cause', 'effect', 'abstract', 'pending']),
  status: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  meta: nodeMetaSchema.optional(),
  shortDefinition: z.string().optional().nullable(),
})

const themeTreeSaveSchema = z.object({
  themeId: z.string(),
  rootNodeIds: z.array(z.string()),
  nodes: z.record(z.string(), themeTreeNodeSchema),
  meta: z.object({
    importedThemeCardIds: z.array(z.string().uuid()).optional(),
    queueTrayMinimized: z.boolean().optional(),
  }).optional(),
})

const themeTreeCommandSchema = z.object({
  commandName: z.enum([
    'create_node',
    'create_sibling_node',
    'rename_node',
    'delete_node',
    'move_node_as_child',
    'move_node_as_sibling',
    'toggle_node_collapsed',
    'update_node_meta',
    'update_node_notes',
    'import_theme_snapshot',
  ]),
  targetId: z.string().nullable().optional(),
  targetType: z.enum(['theme_tree', 'theme_node', 'theme_card']).optional(),
  clientVersion: z.number().int().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  snapshot: themeTreeSaveSchema,
})

const extractThemeCardSchema = z.object({
  nodeId: z.string(),
  themeId: z.string().trim().min(1).max(120),
  snapshot: bookTreeSaveSchema,
})

const themeManageSchema = z.object({
  themeId: z.string().trim().min(1).max(120),
})

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
})

const quoteWorkspaceSchema = z.object({
  quoteId: z.string().uuid().nullable().optional(),
  bookId: z.string().uuid(),
  text: z.string().trim().min(1),
  nodes: z.record(z.string(), z.unknown()),
  rootNodeIds: z.array(z.string()),
  treeTitle: z.string().trim().optional(),
  workspaceKeywords: z.array(z.string().trim().min(1)).optional(),
})

const quoteWorkspaceCommandSchema = z.object({
  commandName: z.enum([
    'create_node',
    'create_sibling_node',
    'rename_node',
    'delete_node',
    'move_node_as_child',
    'move_node_as_sibling',
    'toggle_node_collapsed',
    'update_node_notes',
    'update_node_meta',
    'generate_keyword_nodes',
    'update_quote_text',
  ]),
  targetId: z.string().nullable().optional(),
  targetType: z.enum(['quote_workspace', 'quote_node', 'quote_card']).optional(),
  clientVersion: z.number().int().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  snapshot: quoteWorkspaceSchema,
})

function decodeRouteParam(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

type AuthUser = {
  id: string
  email: string
  displayName: string
  avatarText: string
}

const authSessions = new Map<string, AuthUser>()

function getAuthToken(authorizationHeader: unknown) {
  if (typeof authorizationHeader !== 'string') return null
  const [scheme, token] = authorizationHeader.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

function toAuthUser(row: { id: string; email: string; display_name: string }): AuthUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarText: row.display_name.trim().slice(0, 1).toUpperCase() || 'C',
  }
}

function getConfiguredAuthUser(): AuthUser {
  return {
    id: demoUser.id,
    email: config.AUTH_EMAIL,
    displayName: config.AUTH_DISPLAY_NAME,
    avatarText: config.AUTH_DISPLAY_NAME.trim().slice(0, 1).toUpperCase() || 'C',
  }
}

async function ensureDemoDatabase() {
  const demoSeedMarkerKey = 'demo_seed_v1'
  await query(`
    create table if not exists users (
      id uuid primary key,
      email text not null unique,
      password_hash text not null,
      display_name text not null,
      status text not null default 'active',
      settings_json jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)
  await query(`
    create table if not exists app_meta (
      key text primary key,
      value_json jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)
  await query(`
    create table if not exists book_groups (
      id uuid primary key,
      user_id uuid not null references users(id) on delete cascade,
      name text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)
  await query(`
    create table if not exists books (
      id uuid primary key,
      user_id uuid not null references users(id) on delete cascade,
      group_id uuid,
      title text not null,
      author text,
      cover_url text,
      meta_json jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)
  await query(`
    alter table books
    add column if not exists group_id uuid
  `)
  await query(`
    alter table books
    add column if not exists cover_url text
  `)
  await query(`
    create table if not exists quotes (
      id uuid primary key,
      book_id uuid not null references books(id) on delete cascade,
      chapter_id uuid,
      original_text text not null,
      normalized_text text,
      page_label text,
      tags_json jsonb not null default '[]'::jsonb,
      extraction_status text not null default 'not_started',
      favorite_status boolean not null default false,
      meta_json jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)
  await query(`
    create table if not exists quote_cards (
      id uuid primary key,
      quote_id uuid not null unique references quotes(id) on delete cascade,
      book_id uuid not null references books(id) on delete cascade,
      chapter_id uuid,
      keywords_json jsonb not null default '[]'::jsonb,
      cause_list_json jsonb not null default '[]'::jsonb,
      effect_list_json jsonb not null default '[]'::jsonb,
      middle_step_list_json jsonb not null default '[]'::jsonb,
      pending_list_json jsonb not null default '[]'::jsonb,
      pending_questions_json jsonb not null default '[]'::jsonb,
      candidate_nodes_json jsonb not null default '[]'::jsonb,
      candidate_edges_json jsonb not null default '[]'::jsonb,
      candidate_theme_ids_json jsonb not null default '[]'::jsonb,
      notes_json jsonb not null default '[]'::jsonb,
      status text not null default 'draft',
      workspace_version integer not null default 1,
      pushed_at timestamptz,
      meta_json jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)
  await query(`
    alter table quote_cards
    add column if not exists workspace_version integer not null default 1
  `)
  await query(`
    create table if not exists book_trees (
      id uuid primary key,
      book_id uuid not null references books(id) on delete cascade,
      version integer not null default 1,
      root_node_ids_json jsonb not null default '[]'::jsonb,
      current_status text not null default 'active',
      stats_json jsonb not null default '{}'::jsonb,
      meta_json jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)
  await query(`
    create table if not exists book_nodes (
      id text primary key,
      tree_id uuid not null references book_trees(id) on delete cascade,
      book_id uuid not null references books(id) on delete cascade,
      label text not null,
      node_type text not null,
      parent_id text references book_nodes(id) on delete set null,
      children_ids_json jsonb not null default '[]'::jsonb,
      order_index integer not null default 0,
      short_definition text,
      full_definition text,
      theme_ids_json jsonb not null default '[]'::jsonb,
      source_quote_ids_json jsonb not null default '[]'::jsonb,
      source_chapter_ids_json jsonb not null default '[]'::jsonb,
      note_count integer not null default 0,
      pending_question_count integer not null default 0,
      review_status text not null default 'normal',
      status text not null default 'normal',
      meta_json jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)
  await query(`
    do $$
    begin
      if exists (
        select 1
        from information_schema.columns
        where table_name = 'book_nodes'
          and column_name = 'id'
          and data_type = 'uuid'
      ) then
        if to_regclass('source_mappings') is not null then
          alter table source_mappings drop constraint if exists source_mappings_book_node_id_fkey;
        end if;
        alter table book_nodes drop constraint if exists book_nodes_parent_id_fkey;
        alter table book_nodes alter column parent_id type text using parent_id::text;
        alter table book_nodes alter column id type text using id::text;
        alter table book_nodes
          add constraint book_nodes_parent_id_fkey
          foreign key (parent_id) references book_nodes(id) on delete set null;
      end if;
    end $$;
  `)
  await query(`
    create table if not exists command_logs (
      id uuid primary key,
      user_id uuid not null references users(id) on delete cascade,
      tree_type text not null,
      tree_id uuid not null,
      target_type text not null,
      target_id text,
      command_name text not null,
      payload_json jsonb not null default '{}'::jsonb,
      client_version integer,
      server_version integer,
      result_status text not null default 'succeeded',
      error_message text,
      created_at timestamptz not null default now()
    )
  `)
  await query(`
    create table if not exists theme_trees (
      id uuid primary key,
      user_id uuid not null references users(id) on delete cascade,
      theme_id text not null,
      version integer not null default 1,
      root_node_ids_json jsonb not null default '[]'::jsonb,
      current_status text not null default 'active',
      stats_json jsonb not null default '{}'::jsonb,
      meta_json jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)
  await query(`
    create table if not exists theme_cards (
      id uuid primary key,
      theme_id text not null,
      source_book_tree_id uuid not null references book_trees(id) on delete cascade,
      source_book_id uuid not null references books(id) on delete cascade,
      source_node_id text not null references book_nodes(id) on delete cascade,
      title text not null,
      node_count integer not null default 0,
      queue_status text not null default 'queued_for_theme_tree',
      snapshot_json jsonb not null default '{}'::jsonb,
      meta_json jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)
  await query(`
    create table if not exists theme_nodes (
      id uuid primary key,
      tree_id uuid not null references theme_trees(id) on delete cascade,
      theme_id text not null,
      label text not null,
      node_type text not null,
      parent_id uuid references theme_nodes(id) on delete set null,
      children_ids_json jsonb not null default '[]'::jsonb,
      order_index integer not null default 0,
      short_definition text,
      full_definition text,
      source_book_node_ids_json jsonb not null default '[]'::jsonb,
      related_theme_ids_json jsonb not null default '[]'::jsonb,
      abstract_level integer not null default 0,
      verification_status text not null default 'normal',
      status text not null default 'normal',
      meta_json jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)
  await query(`
    create table if not exists source_mappings (
      id uuid primary key,
      theme_node_id uuid not null references theme_nodes(id) on delete cascade,
      book_node_id text not null references book_nodes(id) on delete cascade,
      book_id uuid not null references books(id) on delete cascade,
      mapping_type text not null default 'direct',
      meta_json jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `)
  await query(`
    do $$
    begin
      if exists (
        select 1
        from information_schema.columns
        where table_name = 'source_mappings'
          and column_name = 'book_node_id'
          and data_type = 'uuid'
      ) then
        alter table source_mappings drop constraint if exists source_mappings_book_node_id_fkey;
        alter table source_mappings alter column book_node_id type text using book_node_id::text;
      end if;

      if exists (
        select 1
        from information_schema.columns
        where table_name = 'book_nodes'
          and column_name = 'id'
          and data_type = 'uuid'
      ) then
        alter table source_mappings drop constraint if exists source_mappings_book_node_id_fkey;
        alter table book_nodes drop constraint if exists book_nodes_parent_id_fkey;
        alter table book_nodes alter column parent_id type text using parent_id::text;
        alter table book_nodes alter column id type text using id::text;
        alter table book_nodes
          add constraint book_nodes_parent_id_fkey
          foreign key (parent_id) references book_nodes(id) on delete set null;
      end if;
    end $$;
  `)

  await query(
    `
      insert into users (id, email, password_hash, display_name)
      values ($1, $2, $3, $4)
      on conflict (id) do update set
        email = excluded.email,
        password_hash = excluded.password_hash,
        display_name = excluded.display_name,
        updated_at = now()
    `,
    [demoUser.id, config.AUTH_EMAIL, config.AUTH_PASSWORD, config.AUTH_DISPLAY_NAME],
  )

  const seedMarker = await query<{ key: string }>(
    'select key from app_meta where key = $1 limit 1',
    [demoSeedMarkerKey],
  )
  if (seedMarker.rows[0]) return

  const currentCounts = await query<{
    group_count: number
    book_count: number
    quote_count: number
  }>(`
    select
      (select count(*)::int from book_groups) as group_count,
      (select count(*)::int from books) as book_count,
      (select count(*)::int from quotes) as quote_count
  `)
  const counts = currentCounts.rows[0] ?? { group_count: 0, book_count: 0, quote_count: 0 }
  const shouldSeedDemoContent =
    Number(counts.group_count ?? 0) === 0 &&
    Number(counts.book_count ?? 0) === 0 &&
    Number(counts.quote_count ?? 0) === 0

  if (shouldSeedDemoContent) {
    const seedGroups = [
      { id: demoGroupIds[0], name: '数据库书籍' },
      { id: demoGroupIds[1], name: '个人成长' },
      { id: demoGroupIds[2], name: '商业与管理' },
    ]

    for (const group of seedGroups) {
      await query(
        `
          insert into book_groups (id, user_id, name)
          values ($1, $2, $3)
          on conflict (id) do update set
            name = excluded.name,
            updated_at = now()
        `,
        [group.id, demoUser.id, group.name],
      )
    }

    const seedBooks = [
      { id: demoBookIds[0], groupId: demoGroupIds[0], title: '《穷查理宝典》', author: '彼得·考夫曼' },
      { id: demoBookIds[1], groupId: demoGroupIds[0], title: '《纳瓦尔宝典》', author: '埃里克·乔根森' },
      { id: demoBookIds[2], groupId: demoGroupIds[1], title: '《原则》', author: '瑞·达利欧' },
    ]

    for (const book of seedBooks) {
      await query(
        `
          insert into books (id, user_id, group_id, title, author)
          values ($1, $2, $3, $4, $5)
          on conflict (id) do update set
            group_id = excluded.group_id,
            title = excluded.title,
            author = excluded.author,
            updated_at = now()
        `,
        [book.id, demoUser.id, book.groupId, book.title, book.author],
      )
    }

    await query(
      `
        update books
        set group_id = $2
        where id = $1 and group_id is null
      `,
      [demoBookIds[2], demoGroupIds[1]],
    )

    await query(
      `
        update books
        set group_id = $2
        where id in ($1, $3) and group_id is null
      `,
      [demoBookIds[0], demoGroupIds[0], demoBookIds[1]],
    )

    const seedQuotes = [
      { id: demoQuoteIds[0], text: '如果在你的一生中，你只关注如何赚钱，而不是关注如何成为一个更有价值的人，那么你最终会失去你的财富。', tags: ['财富', '价值观'], page: 'P12' },
      { id: demoQuoteIds[1], text: '最聪明的投资是投资自己。', tags: ['投资', '成长'], page: 'P15', extractionStatus: 'extracted' },
      { id: demoQuoteIds[2], text: '复利是世界第八大奇迹，知之者赚，不知者被赚。', tags: ['复利'], page: 'P22', extractionStatus: 'extracted' },
      { id: demoQuoteIds[3], text: '不要把所有的鸡蛋放在一个篮子里。', tags: ['风险管理'], page: 'P45' },
      { id: demoQuoteIds[4], text: '种一棵树最好的时间是十年前，其次是现在。', tags: ['行动'], page: 'P88' },
    ]

    for (const quote of seedQuotes) {
      await query(
        `
          insert into quotes (id, book_id, original_text, page_label, tags_json, extraction_status)
          values ($1, $2, $3, $4, $5::jsonb, $6)
        `,
        [quote.id, demoBookIds[0], quote.text, quote.page, JSON.stringify(quote.tags), quote.extractionStatus ?? 'not_started'],
      )
    }
  }

  await query(
    `
      insert into app_meta (key, value_json)
      values ($1, $2::jsonb)
      on conflict (key) do nothing
    `,
    [demoSeedMarkerKey, JSON.stringify({ seededAt: new Date().toISOString() })],
  )
}

function mapGroup(group: any) {
  return {
    id: group.id,
    name: group.name,
    bookCount: Number(group.book_count ?? 0),
  }
}

function mapBook(book: any) {
  return {
    id: book.id,
    groupId: book.group_id,
    title: book.title,
    author: book.author ?? '未知作者',
    coverUrl: book.cover_url ?? null,
    quotesCount: Number(book.quotes_count ?? 0),
    extractedCount: Number(book.extracted_count ?? 0),
    lastUpdated: '刚刚',
    color: '#1e293b',
  }
}

function mapQuote(quote: any, options: { includeTreeSnapshot?: boolean } = {}) {
  const includeTreeSnapshot = options.includeTreeSnapshot ?? true
  const cardMeta = quote.card_meta_json && typeof quote.card_meta_json === 'object' ? quote.card_meta_json : {}
  const quoteMeta = quote.meta_json && typeof quote.meta_json === 'object' ? quote.meta_json : {}
  const treeSnapshot = (cardMeta as any).treeSnapshot
  const treeTitle = (quoteMeta as any).treeTitle || (cardMeta as any).treeTitle
  const workspaceKeywords = Array.isArray(quote.card_keywords_json) ? quote.card_keywords_json : []
  const quoteCardSummary = {
    causeList: Array.isArray(quote.card_cause_list_json) ? quote.card_cause_list_json : [],
    effectList: Array.isArray(quote.card_effect_list_json) ? quote.card_effect_list_json : [],
    middleStepList: Array.isArray(quote.card_middle_step_list_json) ? quote.card_middle_step_list_json : [],
    pendingList: Array.isArray(quote.card_pending_list_json) ? quote.card_pending_list_json : [],
    pendingQuestions: Array.isArray(quote.card_pending_questions_json) ? quote.card_pending_questions_json : [],
    candidateNodes: Array.isArray(quote.card_candidate_nodes_json) ? quote.card_candidate_nodes_json : [],
    candidateEdges: Array.isArray(quote.card_candidate_edges_json) ? quote.card_candidate_edges_json : [],
    notes: Array.isArray(quote.card_notes_json) ? quote.card_notes_json : [],
  }

  return {
    id: quote.id,
    bookId: quote.book_id,
    text: quote.original_text,
    status: quote.extraction_status === 'extracted' ? 'extracted' : 'pending',
    tags: Array.isArray(quote.tags_json) ? quote.tags_json : [],
    page: quote.page_label ?? undefined,
    savedAt: quote.card_updated_at ? new Date(quote.card_updated_at).getTime() : undefined,
    treeTitle,
    nodeCount: treeSnapshot?.nodes
      ? Object.keys(treeSnapshot.nodes).length
      : typeof quote.tree_node_count === 'number'
        ? quote.tree_node_count
        : undefined,
    workspaceVersion: Number(quote.card_workspace_version ?? 1),
    workspaceKeywords,
    quoteCardSummary,
    ...(includeTreeSnapshot ? { treeSnapshot } : {}),
  }
}

function normalizeNodeMeta(metaJson: unknown) {
  if (!metaJson || typeof metaJson !== 'object' || Array.isArray(metaJson)) {
    return {}
  }

  return { ...(metaJson as Record<string, unknown>) }
}

function normalizeThemeTreeMeta(metaJson: unknown) {
  if (!metaJson || typeof metaJson !== 'object' || Array.isArray(metaJson)) {
    return {
      importedThemeCardIds: [] as string[],
      queueTrayMinimized: true,
    }
  }

  const meta = metaJson as Record<string, unknown>
  return {
    importedThemeCardIds: Array.isArray(meta.importedThemeCardIds)
      ? meta.importedThemeCardIds.filter((item): item is string => typeof item === 'string')
      : [],
    queueTrayMinimized: typeof meta.queueTrayMinimized === 'boolean'
      ? meta.queueTrayMinimized
      : true,
  }
}

function extractBookSubtreeSnapshot(
  nodes: Record<string, z.infer<typeof bookTreeNodeSchema>>,
  rootNodeId: string,
) {
  const collectedNodeIds = new Set<string>()

  const visit = (nodeId: string) => {
    const node = nodes[nodeId]
    if (!node || collectedNodeIds.has(nodeId)) return
    collectedNodeIds.add(nodeId)
    node.childrenIds.forEach(visit)
  }

  visit(rootNodeId)
  const orderedNodeIds = Array.from(collectedNodeIds)

  return {
    rootNodeIds: [rootNodeId],
    nodes: Object.fromEntries(
      orderedNodeIds.map((nodeId) => {
        const node = nodes[nodeId]
        if (!node) {
          return [
            nodeId,
            {
              id: nodeId,
              label: '未命名节点',
              parentId: null,
              childrenIds: [],
              orderIndex: 0,
              nodeType: 'concept',
              status: 'normal',
              position: { x: 180, y: 240 },
              meta: {},
            },
          ]
        }
        const filteredChildren = node.childrenIds.filter((childId) => collectedNodeIds.has(childId))

        return [
          nodeId,
          {
            ...node,
            parentId: nodeId === rootNodeId ? null : node.parentId,
            childrenIds: filteredChildren,
            meta: node.meta ?? {},
          },
        ]
      }),
    ),
  }
}

async function ensureActiveBookTree(bookId: string) {
  await ensureDemoDatabase()

  const bookResult = await query<{ id: string; title: string }>(
    'select id, title from books where id = $1',
    [bookId],
  )

  const book = bookResult.rows[0]
  if (!book) {
    return null
  }

  const existingTree = await query<{
    id: string
    book_id: string
    version: number
    root_node_ids_json: unknown
    meta_json: unknown
  }>(
    `
      select id, book_id, version, root_node_ids_json, meta_json
      from book_trees
      where book_id = $1 and current_status = 'active'
      limit 1
    `,
    [bookId],
  )

  if (existingTree.rows[0]) {
    return {
      book,
      tree: existingTree.rows[0],
    }
  }

  const treeId = randomUUID()
  const rootNodeId = randomUUID()
  const treeMeta = {
    importedQuoteIds: [],
    importedCards: [],
  }

  await query(
    `
      insert into book_trees (id, book_id, version, root_node_ids_json, current_status, stats_json, meta_json)
      values ($1, $2, 1, $3::jsonb, 'active', '{}'::jsonb, $4::jsonb)
    `,
    [treeId, bookId, JSON.stringify([rootNodeId]), JSON.stringify(treeMeta)],
  )

  await query(
    `
      insert into book_nodes (
        id, tree_id, book_id, label, node_type, parent_id,
        children_ids_json, order_index, short_definition, status, meta_json
      )
      values ($1, $2, $3, $4, 'concept', null, '[]'::jsonb, 0, null, 'normal', $5::jsonb)
    `,
    [
      rootNodeId,
      treeId,
      bookId,
      book.title,
      JSON.stringify({
        position: { x: 180, y: 320 },
        notes: [],
      }),
    ],
  )

  return {
    book,
    tree: {
      id: treeId,
      book_id: bookId,
      version: 1,
      root_node_ids_json: [rootNodeId],
      meta_json: treeMeta,
    },
  }
}

async function getBookTreePayload(treeId: string) {
  const treeResult = await query<{
    id: string
    book_id: string
    version: number
    root_node_ids_json: unknown
    meta_json: unknown
  }>(
    `
      select id, book_id, version, root_node_ids_json, meta_json
      from book_trees
      where id = $1
      limit 1
    `,
    [treeId],
  )

  const tree = treeResult.rows[0]
  if (!tree) return null

  const nodeResult = await query<{
    id: string
    label: string
    parent_id: string | null
    children_ids_json: unknown
    order_index: number
    node_type: string
    status: string
    short_definition: string | null
    meta_json: unknown
  }>(
    `
      select
        id, label, parent_id, children_ids_json, order_index,
        node_type, status, short_definition, meta_json
      from book_nodes
      where tree_id = $1
      order by parent_id nulls first, order_index asc, created_at asc
    `,
    [treeId],
  )

  const nodes = Object.fromEntries(
    nodeResult.rows.map((row) => {
      const meta = normalizeNodeMeta(row.meta_json)
      const position = meta.position && typeof meta.position === 'object'
        ? {
            x: Number((meta.position as any).x ?? 180),
            y: Number((meta.position as any).y ?? 240),
          }
        : { x: 180, y: 240 }

      return [row.id, {
        id: row.id,
        label: row.label,
        parentId: row.parent_id,
        childrenIds: Array.isArray(row.children_ids_json) ? row.children_ids_json : [],
        orderIndex: row.order_index,
        nodeType: row.node_type,
        status: row.status,
        position,
        meta,
        shortDefinition: row.short_definition ?? undefined,
      }]
    }),
  )

  const rootNodeIds = Array.isArray(tree.root_node_ids_json)
    ? tree.root_node_ids_json.filter((id): id is string => typeof id === 'string')
    : nodeResult.rows.filter((row) => !row.parent_id).map((row) => row.id)

  const meta = normalizeNodeMeta(tree.meta_json)

  return {
    treeId: tree.id,
    bookId: tree.book_id,
    version: tree.version,
    rootNodeIds,
    nodes,
    meta: {
      importedQuoteIds: Array.isArray(meta.importedQuoteIds) ? meta.importedQuoteIds : [],
      importedCards: Array.isArray(meta.importedCards) ? meta.importedCards : [],
      queueTrayMinimized: typeof meta.queueTrayMinimized === 'boolean' ? meta.queueTrayMinimized : true,
      importedPocketOpen: typeof meta.importedPocketOpen === 'boolean' ? meta.importedPocketOpen : false,
    },
  }
}

async function persistBookTreeSnapshot(
  client: PoolClient,
  treeId: string,
  data: z.infer<typeof bookTreeSaveSchema>,
) {
  const existingTreeResult = await client.query<{
    id: string
    book_id: string
    version: number
    meta_json: unknown
  }>(
    `
      select id, book_id, version, meta_json
      from book_trees
      where id = $1
      limit 1
    `,
    [treeId],
  )

  const existingTree = existingTreeResult.rows[0]
  if (!existingTree) {
    return { ok: false as const, status: 404, message: '未找到书内树。' }
  }

  if (existingTree.book_id !== data.bookId) {
    return { ok: false as const, status: 400, message: '书内树所属书籍不匹配。' }
  }

  const existingMeta = normalizeNodeMeta(existingTree.meta_json)
  const existingImportedQuoteIds = Array.isArray(existingMeta.importedQuoteIds)
    ? existingMeta.importedQuoteIds.filter((id): id is string => typeof id === 'string')
    : []
  const existingImportedCards = Array.isArray(existingMeta.importedCards)
    ? existingMeta.importedCards
    : []
  const incomingImportedQuoteIds = data.meta?.importedQuoteIds ?? []
  const incomingImportedCards = data.meta?.importedCards ?? []
  const nextImportedQuoteIds = incomingImportedQuoteIds.length > 0 || existingImportedQuoteIds.length === 0
    ? incomingImportedQuoteIds
    : existingImportedQuoteIds
  const nextImportedCards = incomingImportedCards.length > 0 || existingImportedCards.length === 0
    ? incomingImportedCards
    : existingImportedCards

  const updateResult = await client.query<{ version: number }>(
    `
      update book_trees
      set root_node_ids_json = $2::jsonb,
          meta_json = $3::jsonb,
          version = version + 1,
          updated_at = now()
      where id = $1
      returning version
    `,
    [
      treeId,
      JSON.stringify(data.rootNodeIds),
      JSON.stringify({
        importedQuoteIds: nextImportedQuoteIds,
        importedCards: nextImportedCards,
        queueTrayMinimized: data.meta?.queueTrayMinimized ?? true,
        importedPocketOpen: data.meta?.importedPocketOpen ?? false,
      }),
    ],
  )

  const nextVersion = updateResult.rows[0]?.version ?? existingTree.version + 1

  await client.query('delete from book_nodes where tree_id = $1', [treeId])

  const getNodeDepth = (nodeId: string, visiting = new Set<string>()): number => {
    const node = data.nodes[nodeId]
    if (!node || !node.parentId) return 0
    if (visiting.has(nodeId)) return 0

    visiting.add(nodeId)
    return getNodeDepth(node.parentId, visiting) + 1
  }

  const sortedNodes = Object.values(data.nodes).sort((left, right) => {
    const depthDiff = getNodeDepth(left.id) - getNodeDepth(right.id)
    if (depthDiff !== 0) return depthDiff

    if (left.parentId !== right.parentId) {
      return String(left.parentId ?? '').localeCompare(String(right.parentId ?? ''))
    }

    return left.orderIndex - right.orderIndex
  })

  for (const node of sortedNodes) {
    const nodeMeta = {
      ...(node.meta ?? {}),
      position: node.position,
    }

    await client.query(
      `
        insert into book_nodes (
          id, tree_id, book_id, label, node_type, parent_id,
          children_ids_json, order_index, short_definition,
          source_quote_ids_json, note_count, status, meta_json
        )
        values (
          $1, $2, $3, $4, $5, $6,
          $7::jsonb, $8, $9,
          $10::jsonb, $11, $12, $13::jsonb
        )
      `,
      [
        node.id,
        treeId,
        data.bookId,
        node.label,
        node.nodeType,
        node.parentId,
        JSON.stringify(node.childrenIds),
        node.orderIndex,
        node.shortDefinition ?? null,
        JSON.stringify(Array.isArray(node.meta?.sourceQuoteIds) ? node.meta?.sourceQuoteIds : []),
        Array.isArray(node.meta?.notes) ? node.meta?.notes.length : 0,
        node.status,
        JSON.stringify(nodeMeta),
      ],
    )
  }

  return {
    ok: true as const,
    serverVersion: nextVersion,
  }
}

function deriveQuoteCardFields(data: z.infer<typeof quoteWorkspaceSchema>) {
  const nodes = Object.values(data.nodes).filter((node): node is Record<string, any> => (
    Boolean(node) &&
    typeof node === 'object' &&
    typeof (node as Record<string, unknown>).id === 'string' &&
    typeof (node as Record<string, unknown>).label === 'string'
  ))

  const candidateNodes = nodes.map((node) => ({
    id: String(node.id),
    label: String(node.label).trim(),
    nodeType: ['concept', 'cause', 'effect', 'abstract', 'pending'].includes(String(node.nodeType))
      ? String(node.nodeType)
      : 'concept',
    parentId: typeof node.parentId === 'string' ? node.parentId : null,
    orderIndex: Number(node.orderIndex ?? 0),
  }))

  const candidateEdges = nodes.flatMap((node) => {
    const parentId = typeof node.parentId === 'string' ? node.parentId : null
    if (!parentId) return []

    return [{
      sourceId: parentId,
      targetId: String(node.id),
      relationType: 'tree_child',
    }]
  })

  const pickLabelsByType = (nodeType: 'cause' | 'effect' | 'pending' | 'abstract') =>
    candidateNodes
      .filter((node) => node.nodeType === nodeType)
      .map((node) => node.label)

  const notes = nodes.flatMap((node) => {
    const noteList: unknown[] = Array.isArray(node.meta?.notes) ? node.meta.notes : []
    return noteList
      .filter((note: unknown): note is Record<string, unknown> => Boolean(note) && typeof note === 'object')
      .map((note: Record<string, unknown>) => ({
        nodeId: String(node.id),
        nodeLabel: String(node.label).trim(),
        title: typeof note.title === 'string' ? note.title : '',
        content: typeof note.content === 'string' ? note.content : '',
      }))
      .filter((note: { title: string; content: string }) => note.title || note.content)
  })

  const pendingQuestions = nodes.flatMap((node) => {
    const questions: unknown[] = Array.isArray(node.meta?.pendingQuestions) ? node.meta.pendingQuestions : []
    return questions
      .map((question: unknown) => typeof question === 'string' ? question.trim() : '')
      .filter(Boolean)
      .map((question: string) => ({
        nodeId: String(node.id),
        nodeLabel: String(node.label).trim(),
        question,
      }))
  })

  return {
    candidateNodes,
    candidateEdges,
    causeList: pickLabelsByType('cause'),
    effectList: pickLabelsByType('effect'),
    middleStepList: pickLabelsByType('abstract'),
    pendingList: pickLabelsByType('pending'),
    pendingQuestions,
    notes,
  }
}

async function persistQuoteWorkspaceSnapshot(
  client: PoolClient,
  data: z.infer<typeof quoteWorkspaceSchema>,
) {
  const treeSnapshot = {
    nodes: data.nodes,
    rootNodeIds: data.rootNodeIds,
  }
  const treeTitle = data.treeTitle || '未命名主题'
  const workspaceKeywords = Array.from(
    new Set(
      (data.workspaceKeywords ?? [])
        .map((keyword) => keyword.trim())
        .filter(Boolean),
    ),
  )
  const derivedFields = deriveQuoteCardFields(data)
  const quoteId = data.quoteId ?? randomUUID()

  if (data.quoteId) {
    const existing = await client.query<{ id: string }>(
      'select id from quotes where id = $1 limit 1',
      [quoteId],
    )

    if (!existing.rows[0]) {
      return { ok: false as const, status: 404, message: '未找到金句。' }
    }

    await client.query(
      `
        update quotes
        set original_text = $2,
            extraction_status = 'extracted',
            meta_json = $3::jsonb,
            updated_at = now()
        where id = $1
      `,
      [quoteId, data.text, JSON.stringify({ treeTitle })],
    )
  } else {
    await client.query(
      `
        insert into quotes (id, book_id, original_text, extraction_status, tags_json, meta_json)
        values ($1, $2, $3, 'extracted', $4::jsonb, $5::jsonb)
      `,
      [quoteId, data.bookId, data.text, JSON.stringify(['已保存']), JSON.stringify({ treeTitle })],
    )
  }

  const workspaceVersionResult = await client.query<{ workspace_version: number }>(
    'select workspace_version from quote_cards where quote_id = $1 limit 1',
    [quoteId],
  )
  const nextWorkspaceVersion = Number(workspaceVersionResult.rows[0]?.workspace_version ?? 0) + 1

  await client.query(
    `
      insert into quote_cards (
        id, quote_id, book_id, status, workspace_version,
        keywords_json, cause_list_json, effect_list_json, middle_step_list_json,
        pending_list_json, pending_questions_json, candidate_nodes_json,
        candidate_edges_json, notes_json, meta_json
      )
      values (
        $1, $2, $3, 'saved', $4,
        $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb,
        $9::jsonb, $10::jsonb, $11::jsonb,
        $12::jsonb, $13::jsonb, $14::jsonb
      )
      on conflict (quote_id) do update set
        status = 'saved',
        workspace_version = excluded.workspace_version,
        keywords_json = excluded.keywords_json,
        cause_list_json = excluded.cause_list_json,
        effect_list_json = excluded.effect_list_json,
        middle_step_list_json = excluded.middle_step_list_json,
        pending_list_json = excluded.pending_list_json,
        pending_questions_json = excluded.pending_questions_json,
        candidate_nodes_json = excluded.candidate_nodes_json,
        candidate_edges_json = excluded.candidate_edges_json,
        notes_json = excluded.notes_json,
        meta_json = excluded.meta_json,
        updated_at = now()
    `,
    [
      randomUUID(),
      quoteId,
      data.bookId,
      nextWorkspaceVersion,
      JSON.stringify(workspaceKeywords),
      JSON.stringify(derivedFields.causeList),
      JSON.stringify(derivedFields.effectList),
      JSON.stringify(derivedFields.middleStepList),
      JSON.stringify(derivedFields.pendingList),
      JSON.stringify(derivedFields.pendingQuestions),
      JSON.stringify(derivedFields.candidateNodes),
      JSON.stringify(derivedFields.candidateEdges),
      JSON.stringify(derivedFields.notes),
      JSON.stringify({ treeTitle, treeSnapshot }),
    ],
  )

  return {
    ok: true as const,
    quoteId,
    workspaceVersion: nextWorkspaceVersion,
  }
}

async function ensureActiveThemeTree(themeId: string) {
  await ensureDemoDatabase()

  const existingTree = await query<{
    id: string
    theme_id: string
    version: number
  }>(
    `
      select id, theme_id, version
      from theme_trees
      where theme_id = $1 and current_status = 'active'
      order by updated_at desc
      limit 1
    `,
    [themeId],
  )

  if (existingTree.rows[0]) {
    return existingTree.rows[0]
  }

  const treeId = randomUUID()
  const rootNodeId = randomUUID()
  const rootLabel = themeId.trim() || '未命名主题'

  await query(
    `
      insert into theme_trees (
        id, user_id, theme_id, version, root_node_ids_json, current_status, stats_json, meta_json
      )
      values ($1, $2, $3, $4, $5::jsonb, 'active', $6::jsonb, $7::jsonb)
    `,
    [
      treeId,
      demoUser.id,
      themeId,
      1,
      JSON.stringify([rootNodeId]),
      JSON.stringify({}),
      JSON.stringify({ importedThemeCardIds: [], queueTrayMinimized: true }),
    ],
  )

  await query(
    `
      insert into theme_nodes (
        id, tree_id, theme_id, label, node_type, parent_id,
        children_ids_json, order_index, short_definition, status, meta_json
      )
      values (
        $1, $2, $3, $4, 'concept', null,
        '[]'::jsonb, 0, null, 'normal', $5::jsonb
      )
    `,
    [
      rootNodeId,
      treeId,
      themeId,
      rootLabel,
      JSON.stringify({
        position: { x: 180, y: 280 },
        notes: [],
      }),
    ],
  )

  return {
    id: treeId,
    theme_id: themeId,
    version: 1,
  }
}

async function persistThemeTreeSnapshot(
  client: PoolClient,
  treeId: string,
  data: z.infer<typeof themeTreeSaveSchema>,
) {
  const existingTreeResult = await client.query<{
    id: string
    theme_id: string
    version: number
  }>(
    `
      select id, theme_id, version
      from theme_trees
      where id = $1
      limit 1
    `,
    [treeId],
  )

  const existingTree = existingTreeResult.rows[0]
  if (!existingTree) {
    return { ok: false as const, status: 404, message: '未找到主题树。' }
  }

  if (existingTree.theme_id !== data.themeId) {
    return { ok: false as const, status: 400, message: '主题树所属主题不匹配。' }
  }

  const updateResult = await client.query<{ version: number }>(
    `
      update theme_trees
      set root_node_ids_json = $2::jsonb,
          meta_json = $3::jsonb,
          version = version + 1,
          updated_at = now()
      where id = $1
      returning version
    `,
    [treeId, JSON.stringify(data.rootNodeIds), JSON.stringify(data.meta ?? {})],
  )

  const nextVersion = updateResult.rows[0]?.version ?? existingTree.version + 1

  if (data.meta?.importedThemeCardIds) {
    await client.query(
      `
        update theme_cards
        set queue_status = case
              when id = any($2::uuid[]) then 'imported_to_theme_tree'
              else 'queued_for_theme_tree'
            end,
            updated_at = now()
        where theme_id = $1
      `,
      [data.themeId, data.meta.importedThemeCardIds],
    )
  }

  await client.query('delete from theme_nodes where tree_id = $1', [treeId])

  const nodesToPersist = Object.values(data.nodes).sort((left, right) => {
    const getDepth = (nodeId: string, visited = new Set<string>()): number => {
      if (visited.has(nodeId)) return 0
      visited.add(nodeId)
      const node = data.nodes[nodeId]
      if (!node?.parentId) return 0
      return getDepth(node.parentId, visited) + 1
    }

    const depthDelta = getDepth(left.id) - getDepth(right.id)
    if (depthDelta !== 0) return depthDelta
    return left.orderIndex - right.orderIndex
  })

  for (const node of nodesToPersist) {
    const nodeMeta = {
      ...(node.meta ?? {}),
      position: node.position,
    }

    await client.query(
      `
        insert into theme_nodes (
          id, tree_id, theme_id, label, node_type, parent_id,
          children_ids_json, order_index, short_definition, status, meta_json
        )
        values (
          $1, $2, $3, $4, $5, $6,
          $7::jsonb, $8, $9, $10, $11::jsonb
        )
      `,
      [
        node.id,
        treeId,
        data.themeId,
        node.label,
        node.nodeType,
        node.parentId,
        JSON.stringify(node.childrenIds),
        node.orderIndex,
        node.shortDefinition ?? null,
        node.status,
        JSON.stringify(nodeMeta),
      ],
    )

    const themeNodeMeta = nodeMeta as Record<string, unknown>
    const sourceBookNodeIds = Array.isArray(themeNodeMeta.sourceBookNodeIds)
      ? themeNodeMeta.sourceBookNodeIds.filter((item: unknown): item is string => typeof item === 'string')
      : []
    const sourceBookId = typeof themeNodeMeta.sourceBookId === 'string' ? themeNodeMeta.sourceBookId : null

    if (sourceBookId && sourceBookNodeIds.length > 0) {
      for (const bookNodeId of sourceBookNodeIds) {
        await client.query(
          `
            insert into source_mappings (
              id, theme_node_id, book_node_id, book_id, mapping_type, meta_json
            )
            values ($1, $2, $3, $4, $5, $6::jsonb)
          `,
          [
            randomUUID(),
            node.id,
            bookNodeId,
            sourceBookId,
            'extracted_theme_card',
            JSON.stringify({ themeId: data.themeId }),
          ],
        )
      }
    }
  }

  return {
    ok: true as const,
    serverVersion: nextVersion,
  }
}

async function getThemeTreePayload(treeId: string) {
  const treeResult = await query<{
    id: string
    theme_id: string
    version: number
    root_node_ids_json: unknown
    meta_json: unknown
  }>(
    `
      select id, theme_id, version, root_node_ids_json, meta_json
      from theme_trees
      where id = $1
      limit 1
    `,
    [treeId],
  )

  const tree = treeResult.rows[0]
  if (!tree) return null

  const nodeResult = await query<{
    id: string
    label: string
    parent_id: string | null
    children_ids_json: unknown
    order_index: number
    node_type: string
    short_definition: string | null
    status: string
    meta_json: unknown
  }>(
    `
      select
        id, label, parent_id, children_ids_json, order_index,
        node_type, short_definition, status, meta_json
      from theme_nodes
      where tree_id = $1
      order by order_index asc, created_at asc
    `,
    [treeId],
  )

  return {
    treeId: tree.id,
    themeId: tree.theme_id,
    version: tree.version,
    rootNodeIds: Array.isArray(tree.root_node_ids_json) ? tree.root_node_ids_json : [],
    meta: normalizeThemeTreeMeta(tree.meta_json),
    nodes: Object.fromEntries(
      nodeResult.rows.map((node) => [
        node.id,
        {
          id: node.id,
          label: node.label,
          parentId: node.parent_id,
          childrenIds: Array.isArray(node.children_ids_json) ? node.children_ids_json : [],
          orderIndex: node.order_index,
          nodeType: ['concept', 'cause', 'effect', 'abstract', 'pending'].includes(node.node_type)
            ? node.node_type
            : 'concept',
          position: normalizeNodeMeta(node.meta_json).position && typeof normalizeNodeMeta(node.meta_json).position === 'object'
            ? {
                x: Number((normalizeNodeMeta(node.meta_json).position as any).x ?? 180),
                y: Number((normalizeNodeMeta(node.meta_json).position as any).y ?? 240),
              }
            : { x: 180, y: 240 },
          meta: normalizeNodeMeta(node.meta_json),
          shortDefinition: node.short_definition ?? undefined,
          status: node.status,
        },
      ]),
    ),
  }
}

async function getLibraryPayload() {
  await ensureDemoDatabase()

  const dbGroups = await query<{
    id: string
    name: string
    book_count: number
  }>(`
    select
      bg.id,
      bg.name,
      count(b.id)::int as book_count
    from book_groups bg
    left join books b on b.group_id = bg.id
    group by bg.id
    order by bg.created_at asc
  `)
  const dbBooks = await query<{
    id: string
    group_id: string
    title: string
    author: string | null
    cover_url: string | null
    quotes_count: number
    extracted_count: number
  }>(`
    select
      b.id,
      b.group_id,
      b.title,
      b.author,
      b.cover_url,
      count(q.id)::int as quotes_count,
      count(q.id) filter (where q.extraction_status = 'extracted')::int as extracted_count
    from books b
    left join quotes q on q.book_id = b.id
    group by b.id
    order by b.created_at asc
  `)
  const dbQuotes = await query(`
    select
      q.*,
      qc.keywords_json as card_keywords_json,
      qc.cause_list_json as card_cause_list_json,
      qc.effect_list_json as card_effect_list_json,
      qc.middle_step_list_json as card_middle_step_list_json,
      qc.pending_list_json as card_pending_list_json,
      qc.pending_questions_json as card_pending_questions_json,
      qc.candidate_nodes_json as card_candidate_nodes_json,
      qc.candidate_edges_json as card_candidate_edges_json,
      qc.notes_json as card_notes_json,
      qc.meta_json - 'treeSnapshot' as card_meta_json,
      (
        select count(*)::int
        from jsonb_object_keys(coalesce(qc.meta_json #> '{treeSnapshot,nodes}', '{}'::jsonb))
      ) as tree_node_count,
      qc.updated_at as card_updated_at,
      qc.workspace_version as card_workspace_version
    from quotes q
    left join quote_cards qc on qc.quote_id = q.id
    order by q.updated_at desc
  `)

  return {
    groups: dbGroups.rows.map(mapGroup),
    books: dbBooks.rows.map(mapBook),
    quotes: dbQuotes.rows.map((quote) => mapQuote(quote, { includeTreeSnapshot: false })),
  }
}

async function getThemeLibraryPayload() {
  await ensureDemoDatabase()

  const themeResult = await query<{
    theme_id: string
    tree_updated_at: string | null
    card_count: number
    imported_count: number
    node_count: number
  }>(
    `
      with theme_card_stats as (
        select
          tc.theme_id,
          count(*)::int as card_count,
          count(*) filter (where tc.queue_status <> 'queued_for_theme_tree')::int as imported_count
        from theme_cards tc
        group by tc.theme_id
      ),
      theme_tree_stats as (
        select
          tt.theme_id,
          max(tt.updated_at)::text as tree_updated_at,
          count(tn.id)::int as node_count
        from theme_trees tt
        left join theme_nodes tn on tn.tree_id = tt.id
        group by tt.theme_id
      ),
      theme_union as (
        select theme_id from theme_tree_stats
        union
        select theme_id from theme_card_stats
      )
      select
        tu.theme_id,
        tts.tree_updated_at,
        coalesce(tcs.card_count, 0)::int as card_count,
        coalesce(tcs.imported_count, 0)::int as imported_count,
        coalesce(tts.node_count, 0)::int as node_count
      from theme_union tu
      left join theme_tree_stats tts on tts.theme_id = tu.theme_id
      left join theme_card_stats tcs on tcs.theme_id = tu.theme_id
      where coalesce(tcs.card_count, 0) > 0 or coalesce(tts.node_count, 0) > 0
      order by tu.theme_id asc
    `,
  )

  return themeResult.rows.map((row) => ({
    themeId: row.theme_id,
    themeName: row.theme_id,
    cardCount: Number(row.card_count ?? 0),
    importedCount: Number(row.imported_count ?? 0),
    nodeCount: Number(row.node_count ?? 0),
    updatedAt: row.tree_updated_at,
  }))
}

export function createApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: config.API_BODY_LIMIT_BYTES,
  })

  app.register(cors, {
    origin: config.CORS_ORIGIN,
  })

  app.get('/health', async () => ok({ status: 'ok' }))

  app.post('/api/v1/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: '邮箱或密码格式不正确' },
      })
    }

    await ensureDemoDatabase()

    const configuredEmail = config.AUTH_EMAIL.trim().toLowerCase()
    if (
      parsed.data.email.trim().toLowerCase() === configuredEmail
      && parsed.data.password === config.AUTH_PASSWORD
    ) {
      const authUser = getConfiguredAuthUser()
      const token = randomUUID()
      authSessions.set(token, authUser)

      return ok({
        token,
        user: authUser,
      })
    }

    const userResult = await query<{
      id: string
      email: string
      password_hash: string
      display_name: string
      status: string
    }>(
      `
        select id, email, password_hash, display_name, status
        from users
        where email = $1
        limit 1
      `,
      [parsed.data.email],
    )
    const user = userResult.rows[0]
    if (!user || user.status !== 'active' || user.password_hash !== parsed.data.password) {
      return reply.code(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: '邮箱或密码错误' },
      })
    }

    const authUser = toAuthUser(user)
    const token = randomUUID()
    authSessions.set(token, authUser)

    return ok({
      token,
      user: authUser,
    })
  })

  app.get('/api/v1/auth/me', async (request, reply) => {
    const token = getAuthToken(request.headers.authorization)
    const user = token ? authSessions.get(token) : null
    if (!user) {
      return reply.code(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: '请先登录' },
      })
    }
    return ok(user)
  })

  app.post('/api/v1/auth/logout', async (request) => {
    const token = getAuthToken(request.headers.authorization)
    if (token) authSessions.delete(token)
    return ok({ loggedOut: true })
  })

  app.get('/api/v1/library', async () => ok(await getLibraryPayload()))

  app.get('/api/v1/theme-library', async () => ok(await getThemeLibraryPayload()))

  app.post('/api/v1/groups', async (request, reply) => {
    const parsed = groupCreateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: '分组参数不正确。' },
      })
    }

    const groupId = randomUUID()
    const name = parsed.data.name

    await ensureDemoDatabase()
    await query(
      `
        insert into book_groups (id, user_id, name)
        values ($1, $2, $3)
      `,
      [groupId, demoUser.id, name],
    )

    return ok({
      id: groupId,
      name,
      bookCount: 0,
    })
  })

  app.patch('/api/v1/groups/:groupId', async (request, reply) => {
    const { groupId } = request.params as { groupId: string }
    const parsed = groupUpdateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: '分组参数不正确。' },
      })
    }

    await ensureDemoDatabase()
    const updated = await query<{ id: string; name: string }>(
      `
        update book_groups
        set name = $2,
            updated_at = now()
        where id = $1
        returning id, name
      `,
      [groupId, parsed.data.name],
    )

    if (!updated.rows[0]) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: '未找到分组。' },
      })
    }

    const countResult = await query<{ book_count: number }>(
      'select count(*)::int as book_count from books where group_id = $1',
      [groupId],
    )

    return ok({
      id: updated.rows[0].id,
      name: updated.rows[0].name,
      bookCount: Number(countResult.rows[0]?.book_count ?? 0),
    })
  })

  app.delete('/api/v1/groups/:groupId', async (request, reply) => {
    const { groupId } = request.params as { groupId: string }

    await ensureDemoDatabase()
    const existing = await query<{ id: string }>('select id from book_groups where id = $1', [groupId])
    if (!existing.rows[0]) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: '未找到分组。' },
      })
    }

    await query('delete from books where group_id = $1', [groupId])
    await query('delete from book_groups where id = $1', [groupId])

    return ok({ id: groupId })
  })

  app.post('/api/v1/books', async (request, reply) => {
    const parsed = bookCreateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: '书籍参数不正确。' },
      })
    }

    await ensureDemoDatabase()
    const group = await query<{ id: string }>('select id from book_groups where id = $1', [parsed.data.groupId])
    if (!group.rows[0]) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: '未找到目标分组。' },
      })
    }

    const bookId = randomUUID()
    const created = await query(
      `
        insert into books (id, user_id, group_id, title, author)
        values ($1, $2, $3, $4, $5)
        returning id, group_id, title, author, cover_url
      `,
      [bookId, demoUser.id, parsed.data.groupId, parsed.data.title, parsed.data.author?.trim() || null],
    )

    return ok({
      ...mapBook({
        ...created.rows[0],
        quotes_count: 0,
        extracted_count: 0,
      }),
    })
  })

  app.patch('/api/v1/books/:bookId', async (request, reply) => {
    const { bookId } = request.params as { bookId: string }
    const parsed = bookUpdateSchema.safeParse(request.body)
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return reply.code(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: '书籍参数不正确。' },
      })
    }

    await ensureDemoDatabase()
    const existing = await query<{ id: string; group_id: string; title: string; author: string | null; cover_url: string | null }>(
      'select id, group_id, title, author, cover_url from books where id = $1',
      [bookId],
    )

    if (!existing.rows[0]) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: '未找到书籍。' },
      })
    }

    const title = parsed.data.title?.trim() ?? existing.rows[0].title
    const author = parsed.data.author?.trim() ?? existing.rows[0].author
    const coverUrl = Object.prototype.hasOwnProperty.call(parsed.data, 'coverUrl')
      ? parsed.data.coverUrl
      : existing.rows[0].cover_url
    const updated = await query(
      `
        update books
        set title = $2,
            author = $3,
            cover_url = $4,
            updated_at = now()
        where id = $1
        returning id, group_id, title, author, cover_url
      `,
      [bookId, title, author, coverUrl],
    )

    const counts = await query<{ quotes_count: number; extracted_count: number }>(
      `
        select
          count(id)::int as quotes_count,
          count(id) filter (where extraction_status = 'extracted')::int as extracted_count
        from quotes
        where book_id = $1
      `,
      [bookId],
    )

    return ok({
      ...mapBook({
        ...updated.rows[0],
        quotes_count: Number(counts.rows[0]?.quotes_count ?? 0),
        extracted_count: Number(counts.rows[0]?.extracted_count ?? 0),
      }),
    })
  })

  app.delete('/api/v1/books/:bookId', async (request, reply) => {
    const { bookId } = request.params as { bookId: string }

    await ensureDemoDatabase()
    const existing = await query<{ id: string }>('select id from books where id = $1', [bookId])
    if (!existing.rows[0]) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: '未找到书籍。' },
      })
    }

    await query('delete from books where id = $1', [bookId])

    return ok({ id: bookId })
  })

  app.delete('/api/v1/quotes/:quoteId', async (request, reply) => {
    const { quoteId } = request.params as { quoteId: string }

    await ensureDemoDatabase()
    const existing = await query<{ id: string }>('select id from quotes where id = $1', [quoteId])
    if (!existing.rows[0]) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: '未找到金句。' },
      })
    }

    await query('delete from quotes where id = $1', [quoteId])

    return ok({ id: quoteId })
  })

  app.post('/api/v1/quote-workspaces', async (request, reply) => {
    const parsed = quoteWorkspaceSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: '保存参数不正确。' },
      })
    }

    await ensureDemoDatabase()

    const client = await pool.connect()
    let quoteId: string
    try {
      await client.query('BEGIN')
      const persisted = await persistQuoteWorkspaceSnapshot(client, parsed.data)
      if (!persisted.ok) {
        await client.query('ROLLBACK')
        return reply.code(persisted.status).send({
          success: false,
          error: {
            code: persisted.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
            message: persisted.message,
          },
        })
      }

      quoteId = persisted.quoteId
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    const savedQuote = await query(
      `
        select
          q.*,
          qc.keywords_json as card_keywords_json,
          qc.cause_list_json as card_cause_list_json,
          qc.effect_list_json as card_effect_list_json,
          qc.middle_step_list_json as card_middle_step_list_json,
          qc.pending_list_json as card_pending_list_json,
          qc.pending_questions_json as card_pending_questions_json,
          qc.candidate_nodes_json as card_candidate_nodes_json,
          qc.candidate_edges_json as card_candidate_edges_json,
          qc.notes_json as card_notes_json,
          qc.meta_json as card_meta_json,
          qc.updated_at as card_updated_at,
          qc.workspace_version as card_workspace_version
        from quotes q
        left join quote_cards qc on qc.quote_id = q.id
        where q.id = $1
      `,
      [quoteId],
    )

    return ok(mapQuote(savedQuote.rows[0]))
  })

  app.post('/api/v1/quote-workspaces/:quoteId/commands', async (request, reply) => {
    const { quoteId } = request.params as { quoteId: string }
    const parsed = quoteWorkspaceCommandSchema.safeParse(request.body)

    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: '命令参数不正确。' },
      })
    }

    await ensureDemoDatabase()

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const snapshot = {
        ...parsed.data.snapshot,
        quoteId,
      }
      const persisted = await persistQuoteWorkspaceSnapshot(client, snapshot)
      if (!persisted.ok) {
        await client.query('ROLLBACK')
        return reply.code(persisted.status).send({
          success: false,
          error: {
            code: persisted.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
            message: persisted.message,
          },
        })
      }

      await client.query(
        `
          insert into command_logs (
            id, user_id, tree_type, tree_id, target_type, target_id,
            command_name, payload_json, client_version, server_version,
            result_status, error_message
          )
          values (
            $1, $2, $3, $4, $5, $6,
            $7, $8::jsonb, $9, $10,
            $11, $12
          )
        `,
        [
          randomUUID(),
          demoUser.id,
          'quote_workspace',
          quoteId,
          parsed.data.targetType ?? 'quote_node',
          parsed.data.targetId ?? null,
          parsed.data.commandName,
          JSON.stringify(parsed.data.payload),
          parsed.data.clientVersion ?? null,
          persisted.workspaceVersion ?? null,
          'succeeded',
          null,
        ],
      )

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    const savedQuote = await query(
      `
        select
          q.*,
          qc.keywords_json as card_keywords_json,
          qc.cause_list_json as card_cause_list_json,
          qc.effect_list_json as card_effect_list_json,
          qc.middle_step_list_json as card_middle_step_list_json,
          qc.pending_list_json as card_pending_list_json,
          qc.pending_questions_json as card_pending_questions_json,
          qc.candidate_nodes_json as card_candidate_nodes_json,
          qc.candidate_edges_json as card_candidate_edges_json,
          qc.notes_json as card_notes_json,
          qc.meta_json as card_meta_json,
          qc.updated_at as card_updated_at,
          qc.workspace_version as card_workspace_version
        from quotes q
        left join quote_cards qc on qc.quote_id = q.id
        where q.id = $1
      `,
      [quoteId],
    )

    return ok(mapQuote(savedQuote.rows[0]))
  })

  app.get('/api/v1/quote-workspaces/:quoteId', async (request, reply) => {
    const { quoteId } = request.params as { quoteId: string }
    const quote = await query(
      `
        select
          q.*,
          qc.keywords_json as card_keywords_json,
          qc.cause_list_json as card_cause_list_json,
          qc.effect_list_json as card_effect_list_json,
          qc.middle_step_list_json as card_middle_step_list_json,
          qc.pending_list_json as card_pending_list_json,
          qc.pending_questions_json as card_pending_questions_json,
          qc.candidate_nodes_json as card_candidate_nodes_json,
          qc.candidate_edges_json as card_candidate_edges_json,
          qc.notes_json as card_notes_json,
          qc.meta_json as card_meta_json,
          qc.updated_at as card_updated_at,
          qc.workspace_version as card_workspace_version
        from quotes q
        left join quote_cards qc on qc.quote_id = q.id
        where q.id = $1
      `,
      [quoteId],
    )

    if (!quote.rows[0]) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: '未找到金句。' },
      })
    }

    return ok(mapQuote(quote.rows[0]))
  })

  app.get('/api/v1/books', async () => {
    await ensureDemoDatabase()
    const result = await query<{
      id: string
      title: string
      author: string | null
      quotes_count: number
      extracted_count: number
    }>(`
      select
        b.id,
        b.title,
        b.author,
        count(q.id)::int as quotes_count,
        count(*) filter (where q.extraction_status = 'extracted')::int as extracted_count
      from books b
      left join quotes q on q.book_id = b.id
      group by b.id
      order by b.created_at asc
    `)

    return ok(
      { items: result.rows.map(mapBook) },
      {
        page: 1,
        pageSize: result.rows.length,
        total: result.rows.length,
      },
    )
  })

  app.get('/api/v1/books/:bookId/quotes', async (request) => {
    const { bookId } = request.params as { bookId: string }
    await ensureDemoDatabase()
    const quotes = await query<{
      id: string
      original_text: string
      page_label: string | null
      chapter_id: string | null
      extraction_status: string
      favorite_status: boolean
      created_at: string
      updated_at: string
    }>(
      `
        select
          id,
          original_text,
          page_label,
          chapter_id,
          extraction_status,
          favorite_status,
          created_at,
          updated_at
        from quotes
        where book_id = $1
        order by updated_at desc
      `,
      [bookId],
    )
    const items = quotes.rows.map((quote) => ({
      id: quote.id,
      originalText: quote.original_text,
      pageLabel: quote.page_label,
      chapterId: quote.chapter_id,
      extractionStatus: quote.extraction_status,
      favoriteStatus: quote.favorite_status,
      createdAt: quote.created_at,
      updatedAt: quote.updated_at,
    }))

    return ok({ items }, { page: 1, pageSize: items.length, total: items.length })
  })

  app.get('/api/v1/quotes/:quoteId/quote-card', async (request, reply) => {
    const { quoteId } = request.params as { quoteId: string }
    await ensureDemoDatabase()
    const card = await query<{
      id: string
      quote_id: string
      book_id: string
      keywords_json: unknown
      cause_list_json: unknown
      effect_list_json: unknown
      middle_step_list_json: unknown
      pending_list_json: unknown
      pending_questions_json: unknown
      candidate_nodes_json: unknown
      candidate_edges_json: unknown
      candidate_theme_ids_json: unknown
      notes_json: unknown
      status: string
      updated_at: string
    }>(
      `
        select
          id,
          quote_id,
          book_id,
          keywords_json,
          cause_list_json,
          effect_list_json,
          middle_step_list_json,
          pending_list_json,
          pending_questions_json,
          candidate_nodes_json,
          candidate_edges_json,
          candidate_theme_ids_json,
          notes_json,
          status,
          updated_at
        from quote_cards
        where quote_id = $1
        limit 1
      `,
      [quoteId],
    )

    if (!card.rows[0]) {
      return reply.code(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '未找到 QuoteCard。',
        },
      })
    }

    const row = card.rows[0]
    return ok({
      id: row.id,
      quoteId: row.quote_id,
      bookId: row.book_id,
      keywords: Array.isArray(row.keywords_json) ? row.keywords_json : [],
      causeList: Array.isArray(row.cause_list_json) ? row.cause_list_json : [],
      effectList: Array.isArray(row.effect_list_json) ? row.effect_list_json : [],
      middleStepList: Array.isArray(row.middle_step_list_json) ? row.middle_step_list_json : [],
      pendingList: Array.isArray(row.pending_list_json) ? row.pending_list_json : [],
      pendingQuestions: Array.isArray(row.pending_questions_json) ? row.pending_questions_json : [],
      candidateNodes: Array.isArray(row.candidate_nodes_json) ? row.candidate_nodes_json : [],
      candidateEdges: Array.isArray(row.candidate_edges_json) ? row.candidate_edges_json : [],
      candidateThemeIds: Array.isArray(row.candidate_theme_ids_json) ? row.candidate_theme_ids_json : [],
      notes: Array.isArray(row.notes_json) ? row.notes_json : [],
      status: row.status,
      updatedAt: row.updated_at,
    })
  })

  app.get('/api/v1/books/:bookId/book-tree/context', async (request, reply) => {
    const { bookId } = request.params as { bookId: string }
    const ensured = await ensureActiveBookTree(bookId)

    if (!ensured) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: '未找到书籍。' },
      })
    }

    const queueCountResult = await query<{ pruning_queue_count: number }>(
      `
        select count(*)::int as pruning_queue_count
        from quote_cards
        where book_id = $1 and status in ('saved', 'queued_for_book_tree')
      `,
      [bookId],
    )

    return ok({
      bookId,
      bookName: ensured.book.title,
      activeTreeId: ensured.tree.id,
      activeVersion: ensured.tree.version,
      pruningQueueCount: Number(queueCountResult.rows[0]?.pruning_queue_count ?? 0),
      mergeSuggestionCount: 0,
    })
  })

  app.get('/api/v1/book-trees/:treeId', async (request, reply) => {
    const { treeId } = request.params as { treeId: string }
    const payload = await getBookTreePayload(treeId)

    if (!payload) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: '未找到书内树。' },
      })
    }

    return ok(payload)
  })

  app.put('/api/v1/book-trees/:treeId', async (request, reply) => {
    const { treeId } = request.params as { treeId: string }
    const parsed = bookTreeSaveSchema.safeParse(request.body)

    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: '书内树保存参数不正确。' },
      })
    }

    await ensureDemoDatabase()

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const persisted = await persistBookTreeSnapshot(client, treeId, parsed.data)
      if (!persisted.ok) {
        await client.query('ROLLBACK')
        return reply.code(persisted.status).send({
          success: false,
          error: {
            code: persisted.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
            message: persisted.message,
          },
        })
      }

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    const payload = await getBookTreePayload(treeId)
    return ok(payload)
  })

  app.post('/api/v1/book-trees/:treeId/commands', async (request, reply) => {
    const { treeId } = request.params as { treeId: string }
    const parsed = bookTreeCommandSchema.safeParse(request.body)

    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: '命令参数不正确。' },
      })
    }

    await ensureDemoDatabase()

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const persisted = await persistBookTreeSnapshot(client, treeId, parsed.data.snapshot)
      if (!persisted.ok) {
        await client.query('ROLLBACK')
        return reply.code(persisted.status).send({
          success: false,
          error: {
            code: persisted.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
            message: persisted.message,
          },
        })
      }

      await client.query(
        `
          insert into command_logs (
            id, user_id, tree_type, tree_id, target_type, target_id,
            command_name, payload_json, client_version, server_version,
            result_status, error_message
          )
          values (
            $1, $2, $3, $4, $5, $6,
            $7, $8::jsonb, $9, $10,
            $11, $12
          )
        `,
        [
          randomUUID(),
          demoUser.id,
          'book_tree',
          treeId,
          parsed.data.targetType ?? 'book_node',
          parsed.data.targetId ?? null,
          parsed.data.commandName,
          JSON.stringify(parsed.data.payload),
          parsed.data.clientVersion ?? null,
          persisted.serverVersion,
          'succeeded',
          null,
        ],
      )

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    const payload = await getBookTreePayload(treeId)
    return ok(payload)
  })

  app.get('/api/v1/book-trees/:treeId/queue', async (request, reply) => {
    const { treeId } = request.params as { treeId: string }
    await ensureDemoDatabase()

    const treeResult = await query<{
      book_id: string
      meta_json: unknown
    }>(
      `
        select book_id, meta_json
        from book_trees
        where id = $1
        limit 1
      `,
      [treeId],
    )

    const tree = treeResult.rows[0]
    if (!tree) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: '未找到书内树。' },
      })
    }

    const treeMeta = normalizeNodeMeta(tree.meta_json)
    const importedQuoteIds = new Set(
      Array.isArray(treeMeta.importedQuoteIds)
        ? treeMeta.importedQuoteIds.filter((id): id is string => typeof id === 'string')
        : [],
    )

    const queueResult = await query<{
      quote_card_id: string
      source_quote_id: string
      queue_status: string
      quote_text: string
      page_label: string | null
      keywords_json: unknown
      candidate_nodes_json: unknown
      candidate_edges_json: unknown
      meta_json: unknown
    }>(
      `
        select
          qc.id as quote_card_id,
          qc.quote_id as source_quote_id,
          qc.status as queue_status,
          q.original_text as quote_text,
          q.page_label,
          qc.keywords_json,
          qc.candidate_nodes_json,
          qc.candidate_edges_json,
          qc.meta_json
        from quote_cards qc
        inner join quotes q on q.id = qc.quote_id
        where qc.book_id = $1
          and qc.status in ('saved', 'queued_for_book_tree')
        order by qc.updated_at desc
      `,
      [tree.book_id],
    )

    return ok({
      items: queueResult.rows
        .filter((row) => !importedQuoteIds.has(row.source_quote_id))
        .map((row) => {
          const cardMeta = normalizeNodeMeta(row.meta_json)
          const treeSnapshot = cardMeta.treeSnapshot && typeof cardMeta.treeSnapshot === 'object'
            ? cardMeta.treeSnapshot as { nodes?: Record<string, unknown> }
            : null

          return {
            queueItemId: row.quote_card_id,
            quoteCardId: row.quote_card_id,
            sourceQuoteId: row.source_quote_id,
            quoteText: row.quote_text,
            pageLabel: row.page_label ?? undefined,
            keywords: Array.isArray(row.keywords_json) ? row.keywords_json : [],
            candidateNodes: Array.isArray(row.candidate_nodes_json) ? row.candidate_nodes_json : [],
            candidateEdges: Array.isArray(row.candidate_edges_json) ? row.candidate_edges_json : [],
            treeTitle: typeof cardMeta.treeTitle === 'string' ? cardMeta.treeTitle : undefined,
            nodeCount: treeSnapshot?.nodes ? Object.keys(treeSnapshot.nodes).length : 0,
            treeSnapshot: treeSnapshot && typeof treeSnapshot === 'object'
              ? {
                  nodes: typeof treeSnapshot.nodes === 'object' && treeSnapshot.nodes
                    ? treeSnapshot.nodes
                    : {},
                  rootNodeIds: Array.isArray((treeSnapshot as any).rootNodeIds)
                    ? (treeSnapshot as any).rootNodeIds
                    : [],
                }
              : null,
            suggestedMountPoint: null,
            suggestedTheme: null,
            queueStatus: row.queue_status,
          }
        }),
    })
  })

  app.post('/api/v1/book-trees/:treeId/extract-theme', async (request, reply) => {
    const { treeId } = request.params as { treeId: string }
    const parsed = extractThemeCardSchema.safeParse(request.body)

    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: '提取主题参数不正确。' },
      })
    }

    await ensureDemoDatabase()

    const treeResult = await query<{
      id: string
      book_id: string
      book_title: string
      book_author: string | null
    }>(
      `
        select
          bt.id,
          bt.book_id,
          b.title as book_title,
          b.author as book_author
        from book_trees bt
        inner join books b on b.id = bt.book_id
        where bt.id = $1
        limit 1
      `,
      [treeId],
    )

    const tree = treeResult.rows[0]
    if (!tree) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: '未找到书内树。' },
      })
    }

    if (tree.book_id !== parsed.data.snapshot.bookId) {
      return reply.code(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: '提取主题时书籍上下文不匹配。' },
      })
    }

    const sourceNode = parsed.data.snapshot.nodes[parsed.data.nodeId]
    if (!sourceNode) {
      return reply.code(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: '未找到要提取的节点。' },
      })
    }

    const themeId = parsed.data.themeId.trim()
    const activeThemeTree = await ensureActiveThemeTree(themeId)
    const subtreeSnapshot = extractBookSubtreeSnapshot(parsed.data.snapshot.nodes, parsed.data.nodeId)
    const themeCardId = randomUUID()

    await query(
      `
        insert into theme_cards (
          id, theme_id, source_book_tree_id, source_book_id, source_node_id,
          title, node_count, queue_status, snapshot_json, meta_json
        )
        values (
          $1, $2, $3, $4, $5,
          $6, $7, 'queued_for_theme_tree', $8::jsonb, $9::jsonb
        )
      `,
      [
        themeCardId,
        themeId,
        treeId,
        tree.book_id,
        parsed.data.nodeId,
        sourceNode.label,
        Object.keys(subtreeSnapshot.nodes).length,
        JSON.stringify(subtreeSnapshot),
        JSON.stringify({
          sourceBookTitle: tree.book_title,
          sourceBookAuthor: tree.book_author ?? '未知作者',
          sourceNodeLabel: sourceNode.label,
        }),
      ],
    )

    return ok({
      themeCardId,
      themeId,
      themeTreeId: activeThemeTree.id,
      title: sourceNode.label,
      nodeCount: Object.keys(subtreeSnapshot.nodes).length,
    })
  })

  app.get('/api/v1/themes/:themeId/context', async (request) => {
    const params = request.params as { themeId: string }
    const themeId = decodeRouteParam(params.themeId)
    const activeTree = await ensureActiveThemeTree(themeId)

    const pendingVerifyResult = await query<{ pending_count: number }>(
      `
        select count(*)::int as pending_count
        from theme_nodes
        where tree_id = $1 and status = 'pending_verify'
      `,
      [activeTree.id],
    )

    const sourceBookCount = await query<{ source_book_count: number }>(
      `
        select count(distinct book_id)::int as source_book_count
        from source_mappings sm
        inner join theme_nodes tn on tn.id = sm.theme_node_id
        where tn.tree_id = $1
      `,
      [activeTree.id],
    )

    return ok({
      themeId,
      themeName: themeId,
      activeTreeId: activeTree.id,
      activeVersion: activeTree.version,
      selectedSourceBookIds: [],
      crossBookConnectionCount: Number(sourceBookCount.rows[0]?.source_book_count ?? 0),
      pendingVerifyCount: Number(pendingVerifyResult.rows[0]?.pending_count ?? 0),
    })
  })

  app.get('/api/v1/themes', async () => ok(await getThemeLibraryPayload()))

  app.post('/api/v1/themes', async (request, reply) => {
    const parsed = themeManageSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: '主题名称不能为空。' },
      })
    }

    await ensureDemoDatabase()

    const baseThemeId = parsed.data.themeId
    let nextThemeId = baseThemeId
    let suffix = 2

    while (true) {
      const exists = await query<{ exists: boolean }>(
        `
          select exists (
            select 1 from theme_trees where theme_id = $1
            union all
            select 1 from theme_cards where theme_id = $1
          ) as exists
        `,
        [nextThemeId],
      )
      if (!exists.rows[0]?.exists) break
      nextThemeId = `${baseThemeId} ${suffix}`
      suffix += 1
    }

    const tree = await ensureActiveThemeTree(nextThemeId)
    return ok({
      themeId: nextThemeId,
      themeName: nextThemeId,
      activeTreeId: tree.id,
      activeVersion: tree.version,
    })
  })

  app.put('/api/v1/themes/:themeId', async (request, reply) => {
    const params = request.params as { themeId: string }
    const oldThemeId = decodeRouteParam(params.themeId)
    const parsed = themeManageSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: '主题名称不能为空。' },
      })
    }

    const nextThemeId = parsed.data.themeId
    if (nextThemeId === oldThemeId) {
      const tree = await ensureActiveThemeTree(nextThemeId)
      return ok({
        themeId: nextThemeId,
        themeName: nextThemeId,
        activeTreeId: tree.id,
        activeVersion: tree.version,
      })
    }

    await ensureDemoDatabase()

    const duplicate = await query<{ exists: boolean }>(
      `
        select exists (
          select 1 from theme_trees where theme_id = $1
          union all
          select 1 from theme_cards where theme_id = $1
        ) as exists
      `,
      [nextThemeId],
    )
    if (duplicate.rows[0]?.exists) {
      return reply.code(409).send({
        success: false,
        error: { code: 'CONFLICT', message: '该主题已存在。' },
      })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `
          update theme_trees
          set theme_id = $2, updated_at = now()
          where theme_id = $1
        `,
        [oldThemeId, nextThemeId],
      )
      await client.query(
        `
          update theme_cards
          set theme_id = $2, updated_at = now()
          where theme_id = $1
        `,
        [oldThemeId, nextThemeId],
      )
      await client.query(
        `
          update theme_nodes
          set theme_id = $2,
              label = case when parent_id is null and label = $1 then $2 else label end,
              updated_at = now()
          where theme_id = $1
        `,
        [oldThemeId, nextThemeId],
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    const tree = await ensureActiveThemeTree(nextThemeId)
    return ok({
      themeId: nextThemeId,
      themeName: nextThemeId,
      activeTreeId: tree.id,
      activeVersion: tree.version,
    })
  })

  app.delete('/api/v1/themes/:themeId', async (request) => {
    const params = request.params as { themeId: string }
    const themeId = decodeRouteParam(params.themeId)

    await ensureDemoDatabase()

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('delete from theme_cards where theme_id = $1', [themeId])
      await client.query('delete from theme_trees where theme_id = $1', [themeId])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    return ok({ themeId })
  })

  app.get('/api/v1/themes/:themeId/cards', async (request) => {
    const params = request.params as { themeId: string }
    const themeId = decodeRouteParam(params.themeId)
    const cardResult = await query<{
      id: string
      theme_id: string
      source_book_id: string
      source_node_id: string
      title: string
      node_count: number
      queue_status: string
      snapshot_json: unknown
      meta_json: unknown
      created_at: string
    }>(
      `
        select
          tc.id,
          tc.theme_id,
          tc.source_book_id,
          tc.source_node_id,
          tc.title,
          tc.node_count,
          tc.queue_status,
          tc.snapshot_json,
          tc.meta_json,
          tc.created_at
        from theme_cards tc
        where tc.theme_id = $1
        order by tc.updated_at desc, tc.created_at desc
      `,
      [themeId],
    )

    return ok({
      items: cardResult.rows.map((row) => {
        const meta = normalizeNodeMeta(row.meta_json)
        const snapshot = row.snapshot_json && typeof row.snapshot_json === 'object'
          ? row.snapshot_json as { nodes?: Record<string, unknown>; rootNodeIds?: unknown }
          : null

        return {
          themeCardId: row.id,
          themeId: row.theme_id,
          sourceBookId: row.source_book_id,
          sourceNodeId: row.source_node_id,
          title: row.title,
          nodeCount: Number(row.node_count ?? 0),
          queueStatus: row.queue_status,
          createdAt: row.created_at,
          sourceBookTitle: typeof meta.sourceBookTitle === 'string' ? meta.sourceBookTitle : '来源书籍',
          sourceBookAuthor: typeof meta.sourceBookAuthor === 'string' ? meta.sourceBookAuthor : '未知作者',
          treeSnapshot: snapshot
            ? {
                nodes: typeof snapshot.nodes === 'object' && snapshot.nodes ? snapshot.nodes : {},
                rootNodeIds: Array.isArray(snapshot.rootNodeIds) ? snapshot.rootNodeIds : [],
              }
            : null,
        }
      }),
    })
  })

  app.get('/api/v1/theme-trees/:treeId', async (request, reply) => {
    const { treeId } = request.params as { treeId: string }
    const payload = await getThemeTreePayload(treeId)
    if (!payload) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: '未找到主题树。' },
      })
    }
    return ok(payload)
  })

  app.put('/api/v1/theme-trees/:treeId', async (request, reply) => {
    const { treeId } = request.params as { treeId: string }
    const parsed = themeTreeSaveSchema.safeParse(request.body)

    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: '主题树保存参数不正确。' },
      })
    }

    await ensureDemoDatabase()

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const persisted = await persistThemeTreeSnapshot(client, treeId, parsed.data)
      if (!persisted.ok) {
        await client.query('ROLLBACK')
        return reply.code(persisted.status).send({
          success: false,
          error: {
            code: persisted.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
            message: persisted.message,
          },
        })
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    const payload = await getThemeTreePayload(treeId)
    return ok(payload)
  })

  app.post('/api/v1/theme-trees/:treeId/commands', async (request, reply) => {
    const { treeId } = request.params as { treeId: string }
    const parsed = themeTreeCommandSchema.safeParse(request.body)

    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: '主题树命令参数不正确。' },
      })
    }

    await ensureDemoDatabase()

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const persisted = await persistThemeTreeSnapshot(client, treeId, parsed.data.snapshot)
      if (!persisted.ok) {
        await client.query('ROLLBACK')
        return reply.code(persisted.status).send({
          success: false,
          error: {
            code: persisted.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
            message: persisted.message,
          },
        })
      }

      await client.query(
        `
          insert into command_logs (
            id, user_id, tree_type, tree_id, target_type, target_id,
            command_name, payload_json, client_version, server_version,
            result_status, error_message
          )
          values (
            $1, $2, $3, $4, $5, $6,
            $7, $8::jsonb, $9, $10,
            $11, $12
          )
        `,
        [
          randomUUID(),
          demoUser.id,
          'theme_tree',
          treeId,
          parsed.data.targetType ?? 'theme_node',
          parsed.data.targetId ?? null,
          parsed.data.commandName,
          JSON.stringify(parsed.data.payload),
          parsed.data.clientVersion ?? null,
          persisted.serverVersion,
          'succeeded',
          null,
        ],
      )

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    const payload = await getThemeTreePayload(treeId)
    return ok(payload)
  })

  app.get('/api/v1/themes/:themeId/source-books', async (request) => {
    const params = request.params as { themeId: string }
    const themeId = decodeRouteParam(params.themeId)
    const sourceBooks = await query<{
      book_id: string
      title: string
      author: string | null
      contribution_node_count: number
    }>(
      `
        select
          b.id as book_id,
          b.title,
          b.author,
          count(sm.id)::int as contribution_node_count
        from source_mappings sm
        inner join theme_nodes tn on tn.id = sm.theme_node_id
        inner join books b on b.id = sm.book_id
        where tn.theme_id = $1
        group by b.id
        order by contribution_node_count desc, b.created_at asc
      `,
      [themeId],
    )

    if (sourceBooks.rows.length === 0) {
      return ok([])
    }

    return ok(sourceBooks.rows.map((book, index) => ({
      bookId: book.book_id,
      title: book.title,
      author: book.author ?? '未知作者',
      contributionNodeCount: Number(book.contribution_node_count ?? 0),
      isSelected: true,
      isPrimarySource: index === 0,
    })))
  })

  return app
}
