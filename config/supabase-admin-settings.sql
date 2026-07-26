create table if not exists public.configuracoes_sistema (
  id text primary key,
  dados jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);

create table if not exists public.administradores (
  id uuid primary key default gen_random_uuid(),
  usuario text not null unique,
  nome_exibicao text not null,
  perfil text not null default 'administrador',
  senha_hash text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  ultimo_login_em timestamptz
);

alter table public.configuracoes_sistema enable row level security;
alter table public.administradores enable row level security;

comment on table public.configuracoes_sistema is
  'Configurações privadas do chatbot e do expediente. Acesso exclusivo pelo servidor.';

comment on table public.administradores is
  'Administradores do painel. Senhas são armazenadas somente como hash scrypt com salt.';
