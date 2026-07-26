-- CPF passa a ser a chave única de identificação usada pelo chatbot.
-- O telefone continua como chave técnica para preservar vínculos antigos.

alter table public.clientes
add column if not exists cpf text;

update public.clientes
set cpf = regexp_replace(cpf, '\D', '', 'g')
where cpf is not null;

-- Impede duplicidade sem invalidar cadastros antigos que ainda não possuem CPF.
create unique index if not exists clientes_cpf_unique_idx
on public.clientes (cpf)
where cpf is not null and cpf <> '';

create index if not exists agendamentos_from_idx
on public.agendamentos ("from");

comment on column public.clientes.cpf is
'Chave única de identificação do cliente utilizada para consulta, agendamento e reagendamento no chatbot.';
