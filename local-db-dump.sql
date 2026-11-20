--
-- PostgreSQL database dump
--

-- Dumped from database version 17.2
-- Dumped by pg_dump version 17.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: AuthTokenType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AuthTokenType" AS ENUM (
    'EMAIL_VERIFICATION',
    'PASSWORD_RESET',
    'INVITE'
);


--
-- Name: DeploymentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DeploymentStatus" AS ENUM (
    'NOT_DEPLOYED',
    'DEPLOYED',
    'LIVE',
    'DOWN'
);


--
-- Name: DevStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DevStatus" AS ENUM (
    'NOT_STARTED',
    'IN_PROGRESS',
    'COMPLETED'
);


--
-- Name: EmailStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EmailStatus" AS ENUM (
    'SENT',
    'FAILED',
    'SKIPPED'
);


--
-- Name: EnvironmentType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EnvironmentType" AS ENUM (
    'DEV',
    'QA',
    'UAT',
    'STAGING',
    'PROD'
);


--
-- Name: IterationState; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."IterationState" AS ENUM (
    'PLANNED',
    'ACTIVE',
    'COMPLETED'
);


--
-- Name: LinkType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LinkType" AS ENUM (
    'RELATES',
    'BLOCKS',
    'DUPLICATES'
);


--
-- Name: NotificationType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationType" AS ENUM (
    'ASSIGNED',
    'MENTIONED',
    'STATE_CHANGED',
    'COMMENTED',
    'DUE_SOON',
    'ADDED_TO_PROJECT'
);


--
-- Name: Priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Priority" AS ENUM (
    'CRITICAL',
    'HIGH',
    'MEDIUM',
    'LOW'
);


--
-- Name: ProjectRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ProjectRole" AS ENUM (
    'MANAGER',
    'MEMBER',
    'VIEWER'
);


--
-- Name: ProjectStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ProjectStatus" AS ENUM (
    'ACTIVE',
    'ON_HOLD',
    'CLIENT_NO_RESPONSE',
    'COMPLETED',
    'CANCELLED'
);


--
-- Name: Resolution; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Resolution" AS ENUM (
    'FIXED',
    'WONT_FIX',
    'DUPLICATE',
    'CANNOT_REPRODUCE',
    'BY_DESIGN'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'ADMIN',
    'MANAGER',
    'EMPLOYEE'
);


--
-- Name: Severity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Severity" AS ENUM (
    'S1_CRITICAL',
    'S2_HIGH',
    'S3_MEDIUM',
    'S4_LOW'
);


--
-- Name: WorkItemState; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."WorkItemState" AS ENUM (
    'NEW',
    'TRIAGED',
    'TODO',
    'ACTIVE',
    'IN_PROGRESS',
    'RESOLVED',
    'VERIFIED',
    'DONE',
    'CLOSED',
    'REMOVED'
);


--
-- Name: WorkItemType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."WorkItemType" AS ENUM (
    'EPIC',
    'FEATURE',
    'STORY',
    'BUG',
    'TASK'
);


--
-- Name: work_items_search_vector_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.work_items_search_vector_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."search_vector" :=
    setweight(to_tsvector('simple', coalesce(NEW."title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW."description", '')), 'B');
  RETURN NEW;
END
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attachments (
    id uuid NOT NULL,
    work_item_id uuid NOT NULL,
    uploaded_by_id uuid,
    file_name character varying(255) NOT NULL,
    mime_type character varying(150) NOT NULL,
    size integer NOT NULL,
    storage_key character varying(100) NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid NOT NULL,
    actor_id uuid,
    action character varying(100) NOT NULL,
    entity character varying(50) NOT NULL,
    entity_id character varying(64),
    metadata jsonb,
    ip character varying(64),
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: auth_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    type public."AuthTokenType" NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp(3) without time zone NOT NULL,
    used_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid NOT NULL,
    name character varying(50) NOT NULL,
    color character varying(7) DEFAULT '#64748b'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comments (
    id uuid NOT NULL,
    work_item_id uuid NOT NULL,
    author_id uuid,
    body text NOT NULL,
    mentions uuid[] DEFAULT ARRAY[]::uuid[],
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    edited_at timestamp(3) without time zone
);


--
-- Name: credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credentials (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    label character varying(100) NOT NULL,
    username character varying(200),
    url character varying(500),
    environment public."EnvironmentType",
    notes text,
    secret_ciphertext text NOT NULL,
    secret_iv character varying(32) NOT NULL,
    secret_tag character varying(32) NOT NULL,
    key_version integer DEFAULT 1 NOT NULL,
    created_by_id uuid,
    updated_by_id uuid,
    last_rotated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_revealed_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: email_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_logs (
    id uuid NOT NULL,
    "to" character varying(254) NOT NULL,
    subject character varying(255) NOT NULL,
    template character varying(64) NOT NULL,
    status public."EmailStatus" NOT NULL,
    error text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: environments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.environments (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    type public."EnvironmentType" NOT NULL,
    display_name character varying(150),
    url character varying(500),
    status public."DeploymentStatus" DEFAULT 'NOT_DEPLOYED'::public."DeploymentStatus" NOT NULL,
    deployed_at date,
    notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: iteration_capacity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.iteration_capacity (
    iteration_id uuid NOT NULL,
    user_id uuid NOT NULL,
    hours_per_day double precision NOT NULL,
    days_off integer DEFAULT 0 NOT NULL
);


--
-- Name: iteration_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.iteration_snapshots (
    iteration_id uuid NOT NULL,
    date date NOT NULL,
    remaining_work double precision NOT NULL,
    remaining_points double precision NOT NULL,
    total_points double precision NOT NULL,
    open_items integer NOT NULL
);


--
-- Name: iterations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.iterations (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    name character varying(80) NOT NULL,
    goal text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    state public."IterationState" DEFAULT 'PLANNED'::public."IterationState" NOT NULL,
    started_at timestamp(3) without time zone,
    completed_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    baseline_points double precision,
    baseline_work double precision
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    type public."NotificationType" NOT NULL,
    title character varying(255) NOT NULL,
    body character varying(1000),
    link character varying(300),
    actor_id uuid,
    project_id uuid,
    work_item_id uuid,
    read_at timestamp(3) without time zone,
    emailed_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: project_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_members (
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public."ProjectRole" DEFAULT 'MEMBER'::public."ProjectRole" NOT NULL,
    added_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid NOT NULL,
    key character varying(10) NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    category_id uuid,
    priority public."Priority" DEFAULT 'MEDIUM'::public."Priority" NOT NULL,
    status public."ProjectStatus" DEFAULT 'ACTIVE'::public."ProjectStatus" NOT NULL,
    dev_status public."DevStatus" DEFAULT 'NOT_STARTED'::public."DevStatus" NOT NULL,
    start_date date,
    target_date date,
    owner_id uuid,
    created_by_id uuid,
    work_item_seq integer DEFAULT 0 NOT NULL,
    archived_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    board_settings jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    family_id uuid NOT NULL,
    expires_at timestamp(3) without time zone NOT NULL,
    revoked_at timestamp(3) without time zone,
    user_agent character varying(500),
    ip character varying(64),
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: saved_queries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_queries (
    id uuid NOT NULL,
    owner_id uuid NOT NULL,
    name character varying(60) NOT NULL,
    filters jsonb NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(254) NOT NULL,
    password_hash text,
    google_id text,
    avatar_url text,
    role public."Role" DEFAULT 'EMPLOYEE'::public."Role" NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    email_verified_at timestamp(3) without time zone,
    last_login_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    notification_prefs jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: work_item_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_item_history (
    id uuid NOT NULL,
    work_item_id uuid NOT NULL,
    actor_id uuid,
    field character varying(50) NOT NULL,
    old_value text,
    new_value text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: work_item_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_item_links (
    id uuid NOT NULL,
    source_id uuid NOT NULL,
    target_id uuid NOT NULL,
    type public."LinkType" NOT NULL,
    created_by_id uuid,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: work_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_items (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    number integer NOT NULL,
    type public."WorkItemType" NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    state public."WorkItemState" NOT NULL,
    priority public."Priority" DEFAULT 'MEDIUM'::public."Priority" NOT NULL,
    severity public."Severity",
    resolution public."Resolution",
    story_points double precision,
    original_estimate double precision,
    remaining_work double precision,
    completed_work double precision,
    start_date date,
    due_date date,
    tags text[] DEFAULT ARRAY[]::text[],
    environment public."EnvironmentType",
    repro_steps text,
    expected_result text,
    actual_result text,
    assignee_id uuid,
    created_by_id uuid,
    parent_id uuid,
    rank double precision DEFAULT 0 NOT NULL,
    state_changed_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    closed_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    iteration_id uuid,
    due_reminder_for date,
    search_vector tsvector
);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
df49fe22-2fe0-4d07-a0da-2845e47a3ad2	000219e170ec6e66eef26d6e50e61d416adb76edfe45860592af658c8231c524	2026-11-18 13:32:03.912611+05:30	20261118000000_init	\N	\N	2026-11-18 13:32:03.847255+05:30	1
8c3ecd9f-3563-4abb-8a7b-62c0f42e9c17	b2508bdcbbd36af4bbbea3d9d4faebbffb4ced1a3b481eba5549a5e060052ef8	2026-11-18 13:35:27.68836+05:30	20261118080527_projects	\N	\N	2026-11-18 13:35:27.630753+05:30	1
76c81f66-7f2f-42fb-9c86-6a9e2d443f21	eb5fdfce1a6bfa967b68a7e9c96b2ff87626e24fe3c23684a64183dffb3b6068	2026-11-18 14:00:06.452834+05:30	20261118083006_work_items	\N	\N	2026-11-18 14:00:06.350468+05:30	1
a603540b-9f9b-47ad-8763-6c3a901a4449	eec019132c57e4e8d12b75379876e1f810295420fc6066ec86afec8b67b27f6f	2026-11-18 15:02:44.647506+05:30	20261118093244_sprints_board_vault	\N	\N	2026-11-18 15:02:44.591289+05:30	1
9d79882e-0ddc-40f3-b46d-2c8f5da393d2	b1909d9bcddfe41b1324fca16ff08179482357164f3504167c843797ce5a262f	2026-11-18 17:32:49.693158+05:30	20261118120249_sprint_baseline	\N	\N	2026-11-18 17:32:49.495899+05:30	1
d65bf467-4558-4d7a-95a7-3f2690ab17f2	e4cc722dbe81b5a7f72d784eecdbef9c760696b809b1d69d449c80e0415d65c7	2026-11-18 18:34:18.2171+05:30	20261118130337_notifications_search	\N	\N	2026-11-18 18:34:16.071137+05:30	1
3343172d-509f-44b5-bb82-7f0e3fa9f1b1	95ca2f737a1fcc3b8d5d2eea853feb13c5b43d5bc989de096b3eb5ddef072e06	2026-11-18 18:39:34.565629+05:30	20261118131500_search_trigger	\N	\N	2026-11-18 18:39:33.693754+05:30	1
\.


--
-- Data for Name: attachments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.attachments (id, work_item_id, uploaded_by_id, file_name, mime_type, size, storage_key, created_at) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_logs (id, actor_id, action, entity, entity_id, metadata, ip, created_at) FROM stdin;
47a92675-60af-4aa3-b03b-772c7a6032e2	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 08:02:49.882
cfb3f73c-33fa-4416-9e0a-014a05ce7207	28052739-2db0-422e-bb9e-07f3831f3121	auth.login_failed	user	28052739-2db0-422e-bb9e-07f3831f3121	\N	::1	2026-11-18 08:02:50.492
e3777bff-33fd-4d29-b3b4-b3a3e958263d	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 08:02:50.981
2e05c0d2-0a5a-458c-8f24-7ccd1ade2450	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 12:01:59.817
6b6f36c8-df26-4324-9331-1310f23542b6	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	94da1a6d-0efb-44ea-b5b9-c89e4e7e288f	{"role": "MEMBER", "userId": "627c3f47-1906-4bdf-91e8-9082639df4a2"}	\N	2026-11-18 12:02:04.925
617ccbaa-3496-4492-9c74-365ee505e1d3	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	a7493ce3-9e88-4d9a-bac3-67963f3230a2	{"role": "MANAGER"}	\N	2026-11-18 12:03:21.323
0f59c23c-342b-4c97-a202-65d97bd6311e	28052739-2db0-422e-bb9e-07f3831f3121	user.role_changed	user	74821d30-a75e-4879-a66a-a624c094e3f0	{"to": "MANAGER", "from": "EMPLOYEE"}	\N	2026-11-18 08:02:57.826
21d52206-c5d8-41c6-bed6-8fab1bff6e8d	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	07a88b04-3b25-423b-90de-12e459bdc8a1	{"role": "EMPLOYEE"}	\N	2026-11-18 08:02:57.885
8da5298b-dc8b-4a4f-89df-43df7846ecaa	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	e564e883-e7ce-48a5-a39d-cfaf3c41063f	{"role": "EMPLOYEE"}	\N	2026-11-18 12:03:23.731
e487f060-6a13-428e-b6bc-ea196ac1bc2d	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 15:30:37.787
50176fbb-a6bc-42e6-9b80-e604cb40ec60	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	599a9082-6548-4566-b188-0dd40d310646	{"role": "EMPLOYEE"}	\N	2026-11-18 12:03:24.881
f2f5ee27-c5e7-4afa-bbdb-efb642b7dadc	28052739-2db0-422e-bb9e-07f3831f3121	user.deactivated	user	07a88b04-3b25-423b-90de-12e459bdc8a1	\N	\N	2026-11-18 08:03:00.369
f7952a25-d3f7-4506-add2-4cd4ab2b2848	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 08:14:30.908
5bb520bc-6c74-4f1f-a780-a8ded0bef72a	28052739-2db0-422e-bb9e-07f3831f3121	project.imported	project	\N	{"sheet": "Sheet1", "created": ["AEA", "JAA", "BCM", "TP", "LA", "HMS", "BODH", "EISAR"]}	\N	2026-11-18 08:14:31.28
8d42c1dd-bf09-45af-bce5-45f11cce5a3d	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	64478d92-bddd-4fac-8933-1124dbbe3da1	{"role": "MANAGER"}	\N	2026-11-18 08:14:31.523
aa86b629-72e7-4637-8fc0-d40b0d5d84e6	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	68109512-8d55-4a56-8df5-b643a9768fd2	{"role": "VIEWER", "userId": "f569f564-e465-4299-b737-429c5c1ebd5d"}	\N	2026-11-18 12:12:39.912
745c5ab4-cd03-4315-b6c9-0a9f7f5d0636	28052739-2db0-422e-bb9e-07f3831f3121	vault.created	credential	446fe66f-aa60-4639-a34b-41774b7ccb15	{"label": "Coordinator", "projectId": "68109512-8d55-4a56-8df5-b643a9768fd2"}	::1	2026-11-18 12:12:42.07
c094187c-75de-4efc-8d41-7a327a888c77	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	793ab594-d0e6-43b8-b1f4-ba9ffe7bee3b	{"role": "EMPLOYEE"}	\N	2026-11-18 08:14:32.638
37432075-2f03-4fe1-ace4-d860c328d6cb	28052739-2db0-422e-bb9e-07f3831f3121	vault.imported	credential	\N	{"created": 0, "skipped": 3}	::1	2026-11-18 12:12:42.09
3724b82c-56c8-4c57-a36a-f0e533792a51	28052739-2db0-422e-bb9e-07f3831f3121	project.archived	project	68109512-8d55-4a56-8df5-b643a9768fd2	\N	\N	2026-11-18 12:12:42.145
7ce77db4-c5cf-40b9-b232-e61c7a4d0266	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	7af6dda2-cdb0-4632-9154-c6d4878fbeaf	{"role": "MANAGER"}	\N	2026-11-18 12:12:42.89
b6fec8c1-9f27-4de2-ac22-0b640fc00488	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	d336227f-a3bf-487a-ae7e-d71c5ac36e04	{"role": "EMPLOYEE"}	\N	2026-11-18 12:12:44.726
b22b029c-1fc4-47fe-9f39-6f55b5ef045d	28052739-2db0-422e-bb9e-07f3831f3121	project.deleted	project	3fb01796-8720-4206-b8e5-ecdcf1b90d0b	{"key": "CPR", "name": "Customer Portal Revamp"}	\N	2026-11-18 08:14:34.117
018e9cd8-f992-464a-a5cf-48e4a6b7886f	28052739-2db0-422e-bb9e-07f3831f3121	project.exported	project	\N	{"count": 8, "format": "xlsx"}	\N	2026-11-18 08:14:34.142
aa9685aa-7317-4a10-bce2-bd02ba149303	28052739-2db0-422e-bb9e-07f3831f3121	project.exported	project	\N	{"count": 4, "format": "csv"}	\N	2026-11-18 08:14:34.192
a427fdc4-8004-4e16-bc78-bd315570e808	28052739-2db0-422e-bb9e-07f3831f3121	category.created	category	28ad90e6-3853-4b97-a8c3-a4ebceb9a321	\N	\N	2026-11-18 08:14:34.227
3063d2f9-3d00-439b-a318-618b3800b710	28052739-2db0-422e-bb9e-07f3831f3121	category.deleted	category	28ad90e6-3853-4b97-a8c3-a4ebceb9a321	\N	\N	2026-11-18 08:14:34.238
d8555f46-fa78-4fea-8d2d-0c9e42f8bf95	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 08:21:39.126
7f9f3570-9032-4561-929a-70e0e3191431	28052739-2db0-422e-bb9e-07f3831f3121	auth.login_failed	user	28052739-2db0-422e-bb9e-07f3831f3121	\N	::1	2026-11-18 08:21:39.7
8547bb0e-d89f-4fbd-847a-e6dadf06fb2a	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 08:21:40.217
28c42c33-9184-47ed-8d9a-7a6732edb1b8	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	98cbc59f-aa3d-41d8-8d58-d26f6ae90d19	{"role": "MANAGER", "userId": "7af6dda2-cdb0-4632-9154-c6d4878fbeaf"}	\N	2026-11-18 12:12:46.914
84ef59ad-4efe-493b-acc4-e49fa94c20fd	28052739-2db0-422e-bb9e-07f3831f3121	user.role_changed	user	75a267d2-7bb8-4a29-8dea-60da9af1709e	{"to": "MANAGER", "from": "EMPLOYEE"}	\N	2026-11-18 08:21:47.391
7e67c92c-2b8e-46e9-99b7-cd6e232b891e	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	787613b7-874e-43c4-9782-32fa849c5fa0	{"role": "EMPLOYEE"}	\N	2026-11-18 08:21:47.462
eb34ff0c-276e-4b55-a9d2-5c901f8dcec1	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	98cbc59f-aa3d-41d8-8d58-d26f6ae90d19	{"role": "VIEWER", "userId": "d336227f-a3bf-487a-ae7e-d71c5ac36e04"}	\N	2026-11-18 12:12:46.956
d37856a5-19b8-44e3-89be-4aa0c8471382	28052739-2db0-422e-bb9e-07f3831f3121	project.deleted	project	98cbc59f-aa3d-41d8-8d58-d26f6ae90d19	{"key": "E3962334", "name": "E2E Phase3 1795003962334"}	\N	2026-11-18 12:12:48.118
2d8279d7-3ec0-4c7c-ad7b-9a2978d6d534	28052739-2db0-422e-bb9e-07f3831f3121	user.deactivated	user	787613b7-874e-43c4-9782-32fa849c5fa0	\N	\N	2026-11-18 08:21:49.896
661c3a29-13ed-405f-970c-3f73fdca7ac4	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 08:21:50.669
22bd5f69-b74b-4089-a879-7514bfd9657a	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	671134b0-b1a8-4e32-b963-97e1d7f4f4b0	{"role": "MANAGER"}	\N	2026-11-18 08:21:51.304
9fe0745a-5302-4504-a443-3cd56912b6f7	28052739-2db0-422e-bb9e-07f3831f3121	auth.login_failed	user	28052739-2db0-422e-bb9e-07f3831f3121	\N	::1	2026-11-18 12:13:05.431
e3a54693-43c6-43f1-942d-e5b33ad52dda	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	b5a3cc3d-b71a-4dc3-a016-7fcb174c2fc5	{"role": "EMPLOYEE"}	\N	2026-11-18 08:21:52.712
23f0c1d8-ff5d-497b-804c-4090ab34c6ca	\N	user.register	user	74821d30-a75e-4879-a66a-a624c094e3f0	\N	::1	2026-11-18 08:02:51.502
f312c56f-6878-4591-8e91-ae26b1234b7c	28052739-2db0-422e-bb9e-07f3831f3121	project.created	project	94da1a6d-0efb-44ea-b5b9-c89e4e7e288f	{"key": "PX319139"}	\N	2026-11-18 12:02:00.003
a7e8869d-154c-4981-9235-9f60a5b214d0	\N	project.created	project	602d2994-98c8-4363-a8b7-9c4f66f6abae	{"key": "CPR"}	\N	2026-11-18 08:21:54.051
056d6287-bcd7-47d7-9367-0ece80406f55	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	24de9de0-731c-44a9-b155-675a0f5adfcf	{"role": "EMPLOYEE"}	\N	2026-11-18 15:35:09.168
5fa7981e-be7e-4fa6-bfbb-a59d04e025ac	28052739-2db0-422e-bb9e-07f3831f3121	project.deleted	project	94da1a6d-0efb-44ea-b5b9-c89e4e7e288f	{"key": "PX319139", "name": "Phoenix Portal 1795003319139"}	\N	2026-11-18 12:02:07.333
ca2ec7df-cf37-4f3a-8fb6-07e3a79e736c	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	4e827236-fd7a-4067-9fe3-9745fa808a69	{"role": "VIEWER", "userId": "e564e883-e7ce-48a5-a39d-cfaf3c41063f"}	\N	2026-11-18 12:03:25.862
feff31ae-eb37-4b22-b6fd-16ad40d01fa2	28052739-2db0-422e-bb9e-07f3831f3121	vault.created	credential	bb93be9f-6375-443b-ae75-2e2a02050999	{"label": "Coordinator", "projectId": "4e827236-fd7a-4067-9fe3-9745fa808a69"}	::1	2026-11-18 12:03:27.938
dc061a3f-52b6-44f1-b434-0649a9bda411	28052739-2db0-422e-bb9e-07f3831f3121	project.deleted	project	291c0a97-0e0b-4602-a6e5-dbe993552c68	{"key": "CPR", "name": "Customer Portal Revamp"}	\N	2026-11-18 12:13:04.105
586922f3-ab02-4b36-b398-0c0b70db6788	28052739-2db0-422e-bb9e-07f3831f3121	project.exported	project	\N	{"count": 4, "format": "csv"}	\N	2026-11-18 12:13:04.186
b6b9fe92-63f3-43d1-971f-79ee93bd7058	28052739-2db0-422e-bb9e-07f3831f3121	category.created	category	5c4e5c14-5036-44e9-b563-5c4a2e5a6b50	\N	\N	2026-11-18 12:13:04.224
f86f33a6-0430-47cc-aa22-bbc4845317af	28052739-2db0-422e-bb9e-07f3831f3121	category.deleted	category	5c4e5c14-5036-44e9-b563-5c4a2e5a6b50	\N	\N	2026-11-18 12:13:04.238
630ff87e-e622-42e9-ab0a-0a5df10ebfa5	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 12:13:04.922
71d1f4de-d833-47bd-802a-c5bf07fdc303	28052739-2db0-422e-bb9e-07f3831f3121	user.role_changed	user	a8cf25d2-8f59-4fa9-af59-4d4857eec7d7	{"to": "MANAGER", "from": "EMPLOYEE"}	\N	2026-11-18 12:13:12.667
241ccbd4-ad69-4864-a4a4-4c593eecd4f2	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	0ba0cd91-be58-42d0-bc45-76d28c4736f3	{"role": "EMPLOYEE"}	\N	2026-11-18 12:13:13.255
222a2fc2-d2e9-4f6b-8692-a75b84b2ce31	28052739-2db0-422e-bb9e-07f3831f3121	user.deactivated	user	0ba0cd91-be58-42d0-bc45-76d28c4736f3	\N	\N	2026-11-18 12:13:15.24
29dc5402-e9ca-4461-bdfb-1dc539f9c2cd	\N	auth.invite_accepted	user	a7493ce3-9e88-4d9a-bac3-67963f3230a2	\N	\N	2026-11-18 12:03:22.016
fd66510e-f2af-4695-80b6-7c842e237044	\N	sprint.completed	project	4e827236-fd7a-4067-9fe3-9745fa808a69	{"moved": 2, "sprint": "Sprint 1"}	\N	2026-11-18 12:03:27.572
5f570029-08d0-4bf9-9665-a16dc528917f	\N	workitem.created	work_item	6bf2e905-5f46-4811-9c45-e49e2d68b3c9	{"key": "PX954650-2"}	\N	2026-11-18 12:12:40.242
17579d7c-613b-4c26-ac0e-48e3b0ca6f1b	\N	project.updated	project	291c0a97-0e0b-4602-a6e5-dbe993552c68	{"fields": ["description", "status"]}	\N	2026-11-18 12:13:03.96
af0a9b9c-f36d-4389-8f83-2481280644e8	\N	sprint.created	project	94da1a6d-0efb-44ea-b5b9-c89e4e7e288f	{"sprint": "Sprint 1"}	\N	2026-11-18 12:02:05.111
30add9ee-cc69-40fd-b680-3a7d175d3058	\N	sprint.created	project	94da1a6d-0efb-44ea-b5b9-c89e4e7e288f	{"sprint": "Sprint 2"}	\N	2026-11-18 12:02:05.168
2056fd10-4959-4cc6-b4f9-c23f05b672d8	\N	user.register	user	a8cf25d2-8f59-4fa9-af59-4d4857eec7d7	\N	::1	2026-11-18 12:13:06.43
907d853e-a333-4292-a275-3f719ee070c8	\N	auth.password_reset_requested	user	0ba0cd91-be58-42d0-bc45-76d28c4736f3	\N	\N	2026-11-18 12:13:14.263
4c470423-bc25-4863-a9c8-e1364fb7db10	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	606bc8a8-c155-4d19-9613-00d9ded8c5d9	{"role": "EMPLOYEE"}	\N	2026-11-18 13:46:42.077
682b8341-cdba-42ca-a2b6-4cadfc71cafe	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	d4b3ca89-3790-42b3-a638-82357e824740	{"role": "MEMBER", "userId": "606bc8a8-c155-4d19-9613-00d9ded8c5d9"}	\N	2026-11-18 13:46:45.192
3beaede1-ce49-4fdc-a4bd-345057a2143c	28052739-2db0-422e-bb9e-07f3831f3121	project.deleted	project	d4b3ca89-3790-42b3-a638-82357e824740	{"key": "QA600074", "name": "Quasar Analytics 1795009600074"}	\N	2026-11-18 13:46:59.673
ac9b694d-79a0-452b-8725-0358955bed1d	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	9494163e-7c1b-406e-a979-72fd8f967c50	{"role": "EMPLOYEE"}	\N	2026-11-18 13:47:52.066
b52c4083-3bfb-495a-9c36-18e28cbbf63b	28052739-2db0-422e-bb9e-07f3831f3121	project.archived	project	f65d4403-5cdd-4e9d-a174-eaad78dac225	\N	\N	2026-11-18 13:48:10.642
70cd7eac-eb7a-4eae-aed1-90a2940315ea	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	c8432a2f-7dae-4bf8-9631-99229ec60d45	{"role": "MANAGER"}	\N	2026-11-18 13:56:45.453
88c516e2-9ab8-43ba-8b89-a7f866a6a58d	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	b5bbd2a3-6da0-42cb-ac66-ac3dcade450f	{"role": "EMPLOYEE"}	\N	2026-11-18 13:56:48.746
74cd344f-87ac-4639-b669-864f388d7864	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	d1172c6c-234b-42a5-ab1e-b26e2864c007	{"role": "MANAGER", "userId": "c8432a2f-7dae-4bf8-9631-99229ec60d45"}	\N	2026-11-18 13:56:49.752
944a6a34-f9fe-444e-a09a-f6f1b4c8ed79	\N	auth.login	user	647d5364-4331-4832-b45f-78f2e40bf114	{"method": "password"}	::1	2026-11-18 13:47:52.004
35008eb4-89ed-4e05-93db-a9b772a21634	\N	auth.login	user	845717b8-e65d-4e12-acd3-a71a1a676f41	{"method": "password"}	::1	2026-11-18 13:47:54.247
6bcfb30a-71a0-4049-99ee-1ae95f49b1ea	\N	auth.invite_accepted	user	11cc269c-bfc2-4d66-b56f-30354f692a8a	\N	\N	2026-11-18 13:46:41.636
008d0c53-d627-4cbc-8d38-64115edc3b17	\N	auth.invite_accepted	user	9494163e-7c1b-406e-a979-72fd8f967c50	\N	\N	2026-11-18 13:47:52.853
59e79f30-13a1-4df4-a1da-193939785df4	\N	auth.login	user	9494163e-7c1b-406e-a979-72fd8f967c50	{"method": "password"}	::1	2026-11-18 13:47:53.298
3b4c5d69-6e6d-46f8-8186-c4f52c2775d8	\N	auth.invite_accepted	user	c8432a2f-7dae-4bf8-9631-99229ec60d45	\N	\N	2026-11-18 13:56:46.115
3d6c2830-f170-4a5a-a1e9-797e510f5120	\N	workitem.created	work_item	7889b1ac-d585-44cb-bdd9-924aadd90f06	{"key": "QA204441-2"}	\N	2026-11-18 13:57:03.485
5ab4456f-d850-4560-a18a-317becbfe017	\N	workitem.created	work_item	a4f69427-14cd-4a25-beb9-d1778ba62292	{"key": "QA204441-3"}	\N	2026-11-18 13:57:03.572
d375dff0-dcf6-4609-8b48-ff8105d512d4	\N	sprint.started	project	d1172c6c-234b-42a5-ab1e-b26e2864c007	{"sprint": "Sprint V"}	\N	2026-11-18 13:57:03.697
e4d4de9c-0226-4138-92a6-5d782d536649	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	dc48a963-b7dc-4663-9e5b-08fef1b5db52	{"role": "MANAGER"}	\N	2026-11-18 12:02:00.19
d2972740-3116-42c8-a4d0-4925d93ccd51	28052739-2db0-422e-bb9e-07f3831f3121	user.role_changed	user	24de9de0-731c-44a9-b155-675a0f5adfcf	{"to": "ADMIN", "from": "EMPLOYEE"}	\N	2026-11-18 15:35:16.854
bbd96a09-c753-4277-b7e7-476080920bf0	28052739-2db0-422e-bb9e-07f3831f3121	project.deleted	project	602d2994-98c8-4363-a8b7-9c4f66f6abae	{"key": "CPR", "name": "Customer Portal Revamp"}	\N	2026-11-18 08:21:54.485
890d1478-bab6-4920-907a-7e67372494a5	28052739-2db0-422e-bb9e-07f3831f3121	project.exported	project	\N	{"count": 8, "format": "xlsx"}	\N	2026-11-18 08:21:54.511
19284bb7-cf4b-409e-aa6b-5672f3dcc8d4	28052739-2db0-422e-bb9e-07f3831f3121	project.exported	project	\N	{"count": 4, "format": "csv"}	\N	2026-11-18 08:21:54.576
3656662f-659d-4d89-ab17-c2daef8f77f3	28052739-2db0-422e-bb9e-07f3831f3121	category.created	category	b2c58140-6b4b-4ea9-90ff-e75fc5fa94bf	\N	\N	2026-11-18 08:21:54.63
1505fad4-4503-4330-be85-07dc656f76e8	28052739-2db0-422e-bb9e-07f3831f3121	category.deleted	category	b2c58140-6b4b-4ea9-90ff-e75fc5fa94bf	\N	\N	2026-11-18 08:21:54.649
753650a5-1870-4ab1-84b9-5f7f72ab0efb	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 08:22:30.712
d3472ca2-df96-451b-a88c-4e50fa51de9d	28052739-2db0-422e-bb9e-07f3831f3121	auth.login_failed	user	28052739-2db0-422e-bb9e-07f3831f3121	\N	::1	2026-11-18 08:22:31.29
7f382138-3036-4452-83ee-bb419cb5e95b	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 08:22:31.876
3ef19242-1f44-457d-9a3c-1921a84d6a94	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	94da1a6d-0efb-44ea-b5b9-c89e4e7e288f	{"role": "MANAGER", "userId": "dc48a963-b7dc-4663-9e5b-08fef1b5db52"}	\N	2026-11-18 12:02:04.895
facdda42-1469-449d-b798-8c914c0c8166	28052739-2db0-422e-bb9e-07f3831f3121	user.role_changed	user	eaf48ed5-3d25-45d8-8672-d3df47aea9cb	{"to": "MANAGER", "from": "EMPLOYEE"}	\N	2026-11-18 08:22:38.756
541c66b9-8192-422f-90be-a7503afd4076	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	ea247948-4788-435c-bc25-d3f3197d592b	{"role": "EMPLOYEE"}	\N	2026-11-18 08:22:39.343
a41bad58-0197-4740-84f3-2cc234a132cc	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	29229f3c-b536-41ed-90f4-7f1d2a048cb2	{"role": "EMPLOYEE"}	\N	2026-11-18 12:03:22.58
ccdeed8d-009f-42bb-8d5d-0eb9cfa15d52	28052739-2db0-422e-bb9e-07f3831f3121	user.deactivated	user	ea247948-4788-435c-bc25-d3f3197d592b	\N	\N	2026-11-18 08:22:41.708
0bf8e17b-03a8-42a7-8960-b21138aa645f	\N	user.register	user	eaf48ed5-3d25-45d8-8672-d3df47aea9cb	\N	::1	2026-11-18 08:22:32.491
5745e884-006c-4afa-89e9-54ae849ae740	\N	user.email_verified	user	eaf48ed5-3d25-45d8-8672-d3df47aea9cb	\N	\N	2026-11-18 08:22:33.022
b7f18ccd-578e-4101-96cd-debe35e645da	\N	auth.login	user	eaf48ed5-3d25-45d8-8672-d3df47aea9cb	{"method": "password"}	::1	2026-11-18 08:22:33.536
c8e83d03-6b5b-4351-8217-dc659894e756	\N	user.email_verified	user	74821d30-a75e-4879-a66a-a624c094e3f0	\N	\N	2026-11-18 08:02:52.036
0f2bcdde-959a-44df-8538-8c25f4df7e94	\N	auth.login	user	74821d30-a75e-4879-a66a-a624c094e3f0	{"method": "password"}	::1	2026-11-18 08:02:52.64
54a21816-0ae1-48b3-a6d7-3a42f496f0e8	\N	auth.invite_accepted	user	07a88b04-3b25-423b-90de-12e459bdc8a1	\N	\N	2026-11-18 08:02:58.614
6045a2c0-5d3d-493e-85b1-2e46ad4c13a2	\N	auth.login	user	07a88b04-3b25-423b-90de-12e459bdc8a1	{"method": "password"}	::1	2026-11-18 08:02:59.096
f43b08fd-456a-402b-a027-c6be8c858cd0	\N	auth.password_reset_requested	user	07a88b04-3b25-423b-90de-12e459bdc8a1	\N	\N	2026-11-18 08:02:59.127
3b3d5783-1672-4062-a2bd-6413a49203de	\N	auth.password_reset	user	07a88b04-3b25-423b-90de-12e459bdc8a1	\N	\N	2026-11-18 08:02:59.64
9c79dd33-65a5-4604-a17e-475d5400ed06	\N	auth.login	user	07a88b04-3b25-423b-90de-12e459bdc8a1	{"method": "password"}	::1	2026-11-18 08:03:00.263
ae1aeb18-9bdb-46ae-867d-5993de5a54db	\N	auth.invite_accepted	user	ea247948-4788-435c-bc25-d3f3197d592b	\N	\N	2026-11-18 08:22:40.131
efddb5fd-b288-4c9d-a0ca-47b8c09fe2cd	\N	auth.login	user	ea247948-4788-435c-bc25-d3f3197d592b	{"method": "password"}	::1	2026-11-18 08:22:40.622
0d499b46-8a7f-41b8-bd57-842db3ed90fc	\N	auth.password_reset_requested	user	ea247948-4788-435c-bc25-d3f3197d592b	\N	\N	2026-11-18 08:22:40.651
19775c6e-371e-4960-9120-88254744de7e	\N	auth.password_reset	user	ea247948-4788-435c-bc25-d3f3197d592b	\N	\N	2026-11-18 08:22:41.176
0c83776d-e3e0-4029-91ba-445fec1a7587	\N	auth.login	user	ea247948-4788-435c-bc25-d3f3197d592b	{"method": "password"}	::1	2026-11-18 08:22:41.679
cadcf398-43b1-4358-98df-2f27708eff6a	\N	auth.invite_accepted	user	64478d92-bddd-4fac-8933-1124dbbe3da1	\N	\N	2026-11-18 08:14:32.196
d4ab20fd-f040-45c5-bf1f-8fbb2b2d1712	\N	auth.login	user	64478d92-bddd-4fac-8933-1124dbbe3da1	{"method": "password"}	::1	2026-11-18 08:14:32.603
3ebb60ec-d0dc-46dd-bf73-c8f5345c7fa4	\N	project.created	project	3fb01796-8720-4206-b8e5-ecdcf1b90d0b	{"key": "CPR"}	\N	2026-11-18 08:14:33.798
f4fac24b-a384-4df4-9a17-b9ebaf960021	\N	project.member_added	project	3fb01796-8720-4206-b8e5-ecdcf1b90d0b	{"role": "MEMBER", "userId": "793ab594-d0e6-43b8-b1f4-ba9ffe7bee3b"}	\N	2026-11-18 08:14:33.887
09a1999b-d86a-4e43-bb7a-186173f4fae5	\N	project.updated	project	3fb01796-8720-4206-b8e5-ecdcf1b90d0b	{"fields": ["description", "status"]}	\N	2026-11-18 08:14:33.989
ee83cc68-f803-4bdd-b4b9-d5370faf2d6d	\N	project.environment_added	project	3fb01796-8720-4206-b8e5-ecdcf1b90d0b	{"type": "DEV"}	\N	2026-11-18 08:14:34.008
132bff68-f868-4de8-b41d-de7447e3b03d	\N	project.environment_updated	project	3fb01796-8720-4206-b8e5-ecdcf1b90d0b	{"type": "DEV"}	\N	2026-11-18 08:14:34.042
a2f17878-30ea-4b80-b44c-50b831cce828	\N	project.archived	project	3fb01796-8720-4206-b8e5-ecdcf1b90d0b	\N	\N	2026-11-18 08:14:34.06
646f8e51-b102-403a-a9bc-27ecd1ae5fe2	\N	auth.invite_accepted	user	793ab594-d0e6-43b8-b1f4-ba9ffe7bee3b	\N	\N	2026-11-18 08:14:33.312
fe28a7a3-de8c-492d-89d2-e4f19087a56d	\N	auth.login	user	793ab594-d0e6-43b8-b1f4-ba9ffe7bee3b	{"method": "password"}	::1	2026-11-18 08:14:33.754
8a642bc5-45c8-411f-8658-0c25cc41fb08	\N	user.register	user	75a267d2-7bb8-4a29-8dea-60da9af1709e	\N	::1	2026-11-18 08:21:40.804
0c113db0-b2bd-477d-826e-ff00feb52ce1	\N	user.email_verified	user	75a267d2-7bb8-4a29-8dea-60da9af1709e	\N	\N	2026-11-18 08:21:41.391
83bb4865-935b-4be9-af38-c789a9df508b	\N	auth.login	user	75a267d2-7bb8-4a29-8dea-60da9af1709e	{"method": "password"}	::1	2026-11-18 08:21:41.955
b5f7bf3c-744e-49dd-b0ab-9d15aba86bc2	\N	auth.invite_accepted	user	787613b7-874e-43c4-9782-32fa849c5fa0	\N	\N	2026-11-18 08:21:48.25
6c2ce9dd-6f0e-4bce-8c0d-70248e6113c7	\N	auth.login	user	787613b7-874e-43c4-9782-32fa849c5fa0	{"method": "password"}	::1	2026-11-18 08:21:48.772
fd8630e3-a62b-4134-97c6-dd8bd44abe8e	\N	auth.password_reset_requested	user	787613b7-874e-43c4-9782-32fa849c5fa0	\N	\N	2026-11-18 08:21:48.79
a3632da6-b00b-4de9-a13a-3275c492d894	\N	auth.password_reset	user	787613b7-874e-43c4-9782-32fa849c5fa0	\N	\N	2026-11-18 08:21:49.348
f9dab3cd-dff8-40b8-ae5e-4687d08889b9	\N	auth.login	user	787613b7-874e-43c4-9782-32fa849c5fa0	{"method": "password"}	::1	2026-11-18 08:21:49.869
add06bb2-ff1f-4327-8150-b3068e6a6ed6	\N	auth.invite_accepted	user	671134b0-b1a8-4e32-b963-97e1d7f4f4b0	\N	\N	2026-11-18 08:21:52.11
7a74372d-e1a6-42dd-ad31-ab96f0d55d6e	\N	auth.login	user	671134b0-b1a8-4e32-b963-97e1d7f4f4b0	{"method": "password"}	::1	2026-11-18 08:21:52.66
870f2e14-f7c5-4269-bb5e-eb428696060e	\N	project.member_added	project	602d2994-98c8-4363-a8b7-9c4f66f6abae	{"role": "MEMBER", "userId": "b5a3cc3d-b71a-4dc3-a016-7fcb174c2fc5"}	\N	2026-11-18 08:21:54.149
221bdc86-6c82-4403-a91e-8590b4a89e2e	\N	project.updated	project	602d2994-98c8-4363-a8b7-9c4f66f6abae	{"fields": ["description", "status"]}	\N	2026-11-18 08:21:54.317
248c3b55-82d1-4d75-b475-ee5e3c20b2d0	\N	project.environment_added	project	602d2994-98c8-4363-a8b7-9c4f66f6abae	{"type": "DEV"}	\N	2026-11-18 08:21:54.34
c3db396a-20c7-4bb9-bb0e-cf96ff20f9dc	\N	project.environment_updated	project	602d2994-98c8-4363-a8b7-9c4f66f6abae	{"type": "DEV"}	\N	2026-11-18 08:21:54.381
c25539c6-9392-4322-8357-a20e6ef497c4	\N	project.archived	project	602d2994-98c8-4363-a8b7-9c4f66f6abae	\N	\N	2026-11-18 08:21:54.4
ad995474-277e-4f39-827f-6205ca6c5494	\N	auth.invite_accepted	user	b5a3cc3d-b71a-4dc3-a016-7fcb174c2fc5	\N	\N	2026-11-18 08:21:53.471
8fe40660-600e-4e62-b009-1845f26f3020	\N	auth.login	user	b5a3cc3d-b71a-4dc3-a016-7fcb174c2fc5	{"method": "password"}	::1	2026-11-18 08:21:53.996
975bf7c3-0f30-4d34-82d2-da7254d3a1d9	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 08:26:30.98
c1696b38-412e-4d5e-a75f-5fb34a77bd78	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 08:35:43.699
e0cde14a-c9ab-4f1c-95fc-17d77c91f4f6	28052739-2db0-422e-bb9e-07f3831f3121	project.created	project	eacf6153-0085-4b43-baa9-5ef67a75b8e4	{"key": "E3943110"}	\N	2026-11-18 08:35:43.913
449c26a2-0cc7-45a6-9fb6-876d93e36d73	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	9f5708f2-e045-4e76-b815-7f090d73a3d0	{"role": "MANAGER"}	\N	2026-11-18 08:35:44.035
01502b93-6734-4de7-a311-c22ee87a661c	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	627c3f47-1906-4bdf-91e8-9082639df4a2	{"role": "EMPLOYEE"}	\N	2026-11-18 12:02:01.451
80897e65-fc46-4580-b8a1-bcbc89d82f1e	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	d2ca5dbf-2bb2-4b29-bb48-5f735f8125c4	{"role": "EMPLOYEE"}	\N	2026-11-18 08:35:45.168
124c04af-64e2-4535-bd27-14e3335658fa	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	081be336-7030-414a-be22-e643c66edeca	{"role": "EMPLOYEE"}	\N	2026-11-18 08:35:46.265
b75f3bee-4aec-4d84-924e-e9f8d55344de	28052739-2db0-422e-bb9e-07f3831f3121	vault.revealed	credential	a7f7c402-760e-42db-a29c-87ad8f07b997	{"label": "Prod DB"}	::1	2026-11-18 12:02:07.023
9c94b9d2-e8d6-4671-aab6-c6d62b089684	28052739-2db0-422e-bb9e-07f3831f3121	vault.created	credential	7ccbd404-a7f4-415a-ae64-75514d950109	{"label": "Administrator", "projectId": "94da1a6d-0efb-44ea-b5b9-c89e4e7e288f"}	::1	2026-11-18 12:02:07.224
b324bf53-744a-404a-a0bf-f41d2eb4e868	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	39fd29fc-6096-4a44-8911-b649f2646a72	{"role": "EMPLOYEE"}	\N	2026-11-18 08:35:47.114
5c8cfdaf-ca53-4a1d-877a-1e617d8ba552	28052739-2db0-422e-bb9e-07f3831f3121	vault.imported	credential	\N	{"created": 2, "skipped": 1}	::1	2026-11-18 12:02:07.231
02435277-783c-4e96-8e9f-46289d074579	28052739-2db0-422e-bb9e-07f3831f3121	vault.imported	credential	\N	{"created": 0, "skipped": 3}	::1	2026-11-18 12:02:07.251
eb343a6e-17e5-4d92-874d-fa111eb7b909	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	eacf6153-0085-4b43-baa9-5ef67a75b8e4	{"role": "MANAGER", "userId": "9f5708f2-e045-4e76-b815-7f090d73a3d0"}	\N	2026-11-18 08:35:48.051
51de2c4d-7906-4170-bbac-6be04bcf7d91	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	eacf6153-0085-4b43-baa9-5ef67a75b8e4	{"role": "MEMBER", "userId": "d2ca5dbf-2bb2-4b29-bb48-5f735f8125c4"}	\N	2026-11-18 08:35:48.101
edec0ca5-ecd5-4dda-ab83-c927e1e4ebe6	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	eacf6153-0085-4b43-baa9-5ef67a75b8e4	{"role": "VIEWER", "userId": "081be336-7030-414a-be22-e643c66edeca"}	\N	2026-11-18 08:35:48.162
80665007-ed03-4dba-bb58-92573948da2a	28052739-2db0-422e-bb9e-07f3831f3121	project.archived	project	94da1a6d-0efb-44ea-b5b9-c89e4e7e288f	\N	\N	2026-11-18 12:02:07.308
7a848e43-f139-48ce-b5e0-35ac4d1dfbfd	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	4e827236-fd7a-4067-9fe3-9745fa808a69	{"role": "MANAGER", "userId": "a7493ce3-9e88-4d9a-bac3-67963f3230a2"}	\N	2026-11-18 12:03:25.802
89ce97cb-9f91-4cde-b6fe-2b11ad92c3ed	28052739-2db0-422e-bb9e-07f3831f3121	project.exported	project	\N	{"count": 8, "format": "xlsx"}	\N	2026-11-18 12:13:04.129
2b44f203-a890-4cc6-b9a9-bf0043cbb36c	28052739-2db0-422e-bb9e-07f3831f3121	project.deleted	project	eacf6153-0085-4b43-baa9-5ef67a75b8e4	{"key": "E3943110", "name": "E2E Phase3 1794990943110"}	\N	2026-11-18 08:35:49.441
3847f882-b4b0-4850-bd6e-16291214934a	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 08:52:52.954
5399158b-b3ee-46c1-946e-12eecc2cc038	28052739-2db0-422e-bb9e-07f3831f3121	project.created	project	29600c28-2f6d-488b-a3ba-ce00739eca95	{"key": "E3971691"}	\N	2026-11-18 08:52:53.498
42a14926-f116-4e29-8ae4-c96db4866052	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	de390519-03b7-499d-9b3e-1ff714127d02	{"role": "MANAGER"}	\N	2026-11-18 08:52:53.758
7509ba26-2880-4937-8d7f-8c571293c5f7	\N	auth.login	user	e564e883-e7ce-48a5-a39d-cfaf3c41063f	{"method": "password"}	::1	2026-11-18 12:03:24.857
91993a2a-46c4-4ef3-8488-5bf3fafdcb81	\N	workitem.created	work_item	5785c93c-7576-44ab-9a02-b4a408ebdb1e	{"key": "PX954650-3"}	\N	2026-11-18 12:12:40.334
8e099a23-b755-4e0d-a726-74495698ea18	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	da5b3348-466f-446d-bf75-d8e0551e64ef	{"role": "EMPLOYEE"}	\N	2026-11-18 08:52:55.035
cd9e078b-0b45-4fe2-a637-4ed7619ec4dc	\N	sprint.started	project	94da1a6d-0efb-44ea-b5b9-c89e4e7e288f	{"sprint": "Sprint 1"}	\N	2026-11-18 12:02:05.485
0ec33f22-5ba5-4b4c-9923-7ca71879e1f6	\N	vault.rotated	credential	a7f7c402-760e-42db-a29c-87ad8f07b997	{"fields": []}	::1	2026-11-18 12:02:07.011
030e8c9f-d39e-4cc0-99ba-2608f01d5930	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	9680d79f-6096-46d5-b8b3-1743cca3bc9a	{"role": "EMPLOYEE"}	\N	2026-11-18 08:52:56.213
d6e8b172-c1f7-4be7-b013-f7d0116f4f0d	\N	vault.revealed	credential	7ccbd404-a7f4-415a-ae64-75514d950109	{"label": "Administrator"}	::1	2026-11-18 12:02:07.275
8da851f7-f1e9-4bb2-abc8-5a4ef6d0df63	\N	vault.deleted	credential	a7f7c402-760e-42db-a29c-87ad8f07b997	{"label": "Prod DB"}	::1	2026-11-18 12:02:07.289
ee0f45f7-5514-4ce1-acef-4eb83abf8314	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	0984c808-6cc2-448e-9782-589cb3a7c98a	{"role": "EMPLOYEE"}	\N	2026-11-18 08:52:57.628
f7a4982f-ee45-458c-8674-b85e82dde451	\N	auth.invite_accepted	user	627c3f47-1906-4bdf-91e8-9082639df4a2	\N	\N	2026-11-18 12:02:02.112
5ac3f46e-e34d-45ca-be01-586598db1344	28052739-2db0-422e-bb9e-07f3831f3121	auth.login_failed	user	28052739-2db0-422e-bb9e-07f3831f3121	\N	::1	2026-11-18 13:57:39.306
f0b41a90-ab48-45eb-9736-b2071ef1f3f9	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	29600c28-2f6d-488b-a3ba-ce00739eca95	{"role": "MANAGER", "userId": "de390519-03b7-499d-9b3e-1ff714127d02"}	\N	2026-11-18 08:52:58.52
49624520-37e9-4959-9f42-9f216f832bcf	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	29600c28-2f6d-488b-a3ba-ce00739eca95	{"role": "MEMBER", "userId": "da5b3348-466f-446d-bf75-d8e0551e64ef"}	\N	2026-11-18 08:52:58.612
a8af19a3-73db-45be-9627-fb3e88962526	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	29600c28-2f6d-488b-a3ba-ce00739eca95	{"role": "VIEWER", "userId": "9680d79f-6096-46d5-b8b3-1743cca3bc9a"}	\N	2026-11-18 08:52:58.644
d4127189-3758-43fb-883d-06064effcc62	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	135e8510-8c45-430d-af9e-ca3c57e136f2	{"role": "EMPLOYEE"}	\N	2026-11-18 12:02:02.593
5b5cc3ac-e4af-4486-9e94-ad4a05e565db	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	4e2a6dbf-e3ff-4e92-a2ad-6c7e7c1101c7	{"role": "EMPLOYEE"}	\N	2026-11-18 12:02:03.523
a90dd92a-e6c9-4dff-9ddb-51077352fac9	28052739-2db0-422e-bb9e-07f3831f3121	project.deleted	project	29600c28-2f6d-488b-a3ba-ce00739eca95	{"key": "E3971691", "name": "E2E Phase3 1794991971691"}	\N	2026-11-18 08:53:00.611
75b72651-1038-4617-b763-cf7474c057f6	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 08:53:01.257
70890c70-6105-43ac-843d-81e437c002f8	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	15452582-42be-482f-a79d-af2a4fb03a8d	{"role": "EMPLOYEE"}	\N	2026-11-18 08:53:02.848
09b491ef-ca0d-4a59-9726-b7887e913b0c	28052739-2db0-422e-bb9e-07f3831f3121	vault.created	credential	c1b58361-9571-4ad6-9cbd-51442188f8e1	{"label": "Coordinator", "projectId": "94da1a6d-0efb-44ea-b5b9-c89e4e7e288f"}	::1	2026-11-18 12:02:07.23
40695f0c-bf51-4795-bfc6-28ec9c7bd79f	\N	auth.invite_accepted	user	43574b5a-6adb-4855-aae0-7b64d78517db	\N	\N	2026-11-18 08:53:02.393
a26c7df6-7fad-43ba-9235-d578ea7a8786	\N	project.created	project	fa253a85-a11d-4d81-93d2-f5b3217fa25d	{"key": "CPR"}	\N	2026-11-18 08:53:03.991
460a335b-8d08-4731-b738-f685e9f7ae00	\N	project.member_added	project	fa253a85-a11d-4d81-93d2-f5b3217fa25d	{"role": "MEMBER", "userId": "15452582-42be-482f-a79d-af2a4fb03a8d"}	\N	2026-11-18 08:53:04.052
70565252-41ed-4031-a81d-73dd6edb05f8	\N	project.environment_added	project	fa253a85-a11d-4d81-93d2-f5b3217fa25d	{"type": "DEV"}	\N	2026-11-18 08:53:04.534
58509eda-5485-4b2a-a719-76e88bb89d44	\N	auth.invite_accepted	user	15452582-42be-482f-a79d-af2a4fb03a8d	\N	\N	2026-11-18 08:53:03.538
d543c4bf-db39-4773-a7b3-cb19db4a7e7b	\N	workitem.created	work_item	03261f49-ecae-45a2-a7d0-bb64a0fa6099	{"key": "E3971691-2"}	\N	2026-11-18 08:52:59.031
4755e8f0-7d27-4c5a-9f93-c456d3c5c0eb	\N	workitem.created	work_item	fba4bb2b-c71a-4892-bc35-581effcdf54f	{"key": "E3971691-4"}	\N	2026-11-18 08:52:59.14
023cc748-651c-49a5-801c-f334ab557387	\N	project.archived	project	29600c28-2f6d-488b-a3ba-ce00739eca95	\N	\N	2026-11-18 08:53:00.565
cc58f18d-1428-410d-a099-0d210ee092e4	28052739-2db0-422e-bb9e-07f3831f3121	project.deleted	project	4e827236-fd7a-4067-9fe3-9745fa808a69	{"key": "PX400412", "name": "Phoenix Portal 1795003400412"}	\N	2026-11-18 12:03:28.042
5d087900-5a96-46ee-b9e5-c120ed4fb65f	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	81e6b312-e221-4c3b-b1fe-f1877a05fff0	{"role": "EMPLOYEE"}	\N	2026-11-18 12:12:45.715
51860585-d11b-4ff4-87a9-dcc06a284312	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 12:13:05.95
ed47ec75-553d-4a6b-9665-66b632f9fff0	\N	auth.invite_accepted	user	4e2a6dbf-e3ff-4e92-a2ad-6c7e7c1101c7	\N	\N	2026-11-18 12:02:04.379
06e3a47c-fa7f-44a5-8467-40852ce56eef	\N	auth.login	user	4e2a6dbf-e3ff-4e92-a2ad-6c7e7c1101c7	{"method": "password"}	::1	2026-11-18 12:02:04.857
0c895360-b554-41e8-ad80-5c193a0c060b	\N	workitem.created	work_item	187848d4-fa23-47d0-a868-c903b4c2c989	{"key": "PX400412-2"}	\N	2026-11-18 12:03:26.16
6103ac7b-9081-4fc9-9227-42351db7326d	\N	sprint.started	project	4e827236-fd7a-4067-9fe3-9745fa808a69	{"sprint": "Sprint 1"}	\N	2026-11-18 12:03:26.264
d41d7ca6-531d-4ae1-9d2e-c91676c53738	\N	auth.invite_accepted	user	81e6b312-e221-4c3b-b1fe-f1877a05fff0	\N	\N	2026-11-18 12:12:46.441
31576e76-bd40-443c-9a05-9d6166f6035e	\N	auth.login	user	81e6b312-e221-4c3b-b1fe-f1877a05fff0	{"method": "password"}	::1	2026-11-18 12:12:46.892
563cfea8-13ce-495e-8eca-546608bf3a8c	\N	vault.created	credential	a7f7c402-760e-42db-a29c-87ad8f07b997	{"label": "Prod DB", "projectId": "94da1a6d-0efb-44ea-b5b9-c89e4e7e288f"}	::1	2026-11-18 12:02:06.923
3dce7a73-6858-48ab-b970-1de26ced43ff	\N	vault.revealed	credential	a7f7c402-760e-42db-a29c-87ad8f07b997	{"label": "Prod DB"}	::1	2026-11-18 12:02:06.969
0c329746-d5cb-4cb1-8f49-7c712abd6d3c	\N	user.email_verified	user	a8cf25d2-8f59-4fa9-af59-4d4857eec7d7	\N	\N	2026-11-18 12:13:06.912
6c87ea90-7656-46b6-93bf-7d957a6cc47a	\N	auth.login	user	a8cf25d2-8f59-4fa9-af59-4d4857eec7d7	{"method": "password"}	::1	2026-11-18 12:13:07.353
cd9d1e2e-5fb9-4a3a-945b-2c13526b853d	\N	auth.invite_accepted	user	0ba0cd91-be58-42d0-bc45-76d28c4736f3	\N	\N	2026-11-18 12:13:13.723
e0a87f53-97e6-4a8e-8581-25583f1301da	\N	auth.login	user	0ba0cd91-be58-42d0-bc45-76d28c4736f3	{"method": "password"}	::1	2026-11-18 12:13:14.239
a8a88968-11de-459c-9adc-c2f5217fb986	\N	auth.password_reset	user	0ba0cd91-be58-42d0-bc45-76d28c4736f3	\N	\N	2026-11-18 12:13:14.72
4236440c-9774-4f62-b148-735838fced95	\N	auth.login	user	0ba0cd91-be58-42d0-bc45-76d28c4736f3	{"method": "password"}	::1	2026-11-18 12:13:15.21
34926730-088d-4b4f-84eb-7e60b0a3a5c2	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 13:47:50.41
84de72c0-58f9-4408-a297-ccd8ecaa5283	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	f65d4403-5cdd-4e9d-a174-eaad78dac225	{"role": "MEMBER", "userId": "179edead-cc0b-4fcc-bae0-9b5a04bf4130"}	\N	2026-11-18 13:47:59.711
515883d4-c802-4e7c-acdb-0ed355d6ee48	\N	workitem.created	work_item	88b91a6c-d134-4618-b4ae-56d9499e3d35	{"key": "QA669770-2"}	\N	2026-11-18 13:48:09.822
b3b7fcbe-5db9-414b-9c0b-1233ce53c034	\N	workitem.created	work_item	72e1913e-3aa8-4a37-ba06-2992b5f832c6	{"key": "QA669770-4"}	\N	2026-11-18 13:48:10.034
5bde46a6-4d8f-448c-9dd8-3eb9aa7885b3	\N	sprint.started	project	f65d4403-5cdd-4e9d-a174-eaad78dac225	{"sprint": "Sprint V"}	\N	2026-11-18 13:48:10.099
ae5aabbd-16bd-4a87-8eeb-41aa76ef9fa1	\N	report.project_exported	project	f65d4403-5cdd-4e9d-a174-eaad78dac225	\N	\N	2026-11-18 13:48:10.581
49c236df-7990-45ed-bdd9-3837a0447f55	\N	workitem.created	work_item	e16759c3-7737-4a25-bf50-2e086ce47a06	{"key": "QA600074-1"}	\N	2026-11-18 13:46:45.504
c61335cf-172f-4fab-84c0-2f4b96520d0f	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	94da1a6d-0efb-44ea-b5b9-c89e4e7e288f	{"role": "VIEWER", "userId": "135e8510-8c45-430d-af9e-ca3c57e136f2"}	\N	2026-11-18 12:02:05.027
aa3924b1-7d52-490e-a202-3ebe8b7a840e	\N	workitem.created	work_item	2bc6d8e0-819c-4e48-af27-89036f789c95	{"key": "E3971691-3"}	\N	2026-11-18 08:52:59.076
14cf6dcb-33bc-4843-ba59-52bc6e98de62	28052739-2db0-422e-bb9e-07f3831f3121	vault.revealed	credential	5ef8118d-4b5d-4976-adbb-4d6d391eb608	{"label": "Prod DB"}	::1	2026-11-18 12:03:27.738
b039b081-e07d-4703-8dbc-f2a4a6563481	28052739-2db0-422e-bb9e-07f3831f3121	vault.created	credential	4671b360-46bc-41aa-9961-ece6cd7c7b84	{"label": "Administrator", "projectId": "4e827236-fd7a-4067-9fe3-9745fa808a69"}	::1	2026-11-18 12:03:27.92
8a0b69ad-8033-4c7a-aae8-1d4a003cb336	28052739-2db0-422e-bb9e-07f3831f3121	vault.imported	credential	\N	{"created": 2, "skipped": 1}	::1	2026-11-18 12:03:27.94
163d8d4c-d1d5-4673-90c8-d2c696fafb9e	28052739-2db0-422e-bb9e-07f3831f3121	vault.imported	credential	\N	{"created": 0, "skipped": 3}	::1	2026-11-18 12:03:27.96
bde1b64c-ef23-4091-b6c2-17fea93518f6	28052739-2db0-422e-bb9e-07f3831f3121	project.archived	project	4e827236-fd7a-4067-9fe3-9745fa808a69	\N	\N	2026-11-18 12:03:28.014
b1589d20-1a0d-4436-beb4-168576580598	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	98cbc59f-aa3d-41d8-8d58-d26f6ae90d19	{"role": "MEMBER", "userId": "c98b94a1-83f8-48df-984c-1f3eb91c7707"}	\N	2026-11-18 12:12:46.936
25f3a87f-98dc-4827-99b0-ac22275d5b23	\N	auth.invite_accepted	user	135e8510-8c45-430d-af9e-ca3c57e136f2	\N	\N	2026-11-18 12:02:03.042
d870b1a2-8c14-42cb-9fe6-0a38dc388ac8	\N	auth.login	user	135e8510-8c45-430d-af9e-ca3c57e136f2	{"method": "password"}	::1	2026-11-18 12:02:03.497
5781fce5-cf1b-4124-930a-99dcb1e357fa	\N	auth.invite_accepted	user	d336227f-a3bf-487a-ae7e-d71c5ac36e04	\N	\N	2026-11-18 12:12:45.258
42763b17-d376-43ed-8811-12619b3ea45e	\N	auth.login	user	d336227f-a3bf-487a-ae7e-d71c5ac36e04	{"method": "password"}	::1	2026-11-18 12:12:45.692
15935ed0-68e0-4b2b-ab28-f6c17b2944c2	\N	auth.login	user	a7493ce3-9e88-4d9a-bac3-67963f3230a2	{"method": "password"}	::1	2026-11-18 12:03:22.484
66b20454-f874-4afa-9af3-6d2f9e12a8ee	\N	vault.created	credential	5ef8118d-4b5d-4976-adbb-4d6d391eb608	{"label": "Prod DB", "projectId": "4e827236-fd7a-4067-9fe3-9745fa808a69"}	::1	2026-11-18 12:03:27.674
6308ce94-10ba-45c4-b38b-6a6764bc75dd	\N	vault.revealed	credential	5ef8118d-4b5d-4976-adbb-4d6d391eb608	{"label": "Prod DB"}	::1	2026-11-18 12:03:27.708
781450e2-7de5-4b53-ad60-914822f7163b	\N	vault.rotated	credential	5ef8118d-4b5d-4976-adbb-4d6d391eb608	{"fields": []}	::1	2026-11-18 12:03:27.726
aad4ec5f-9873-421f-8fbc-821e3843ad06	\N	vault.revealed	credential	4671b360-46bc-41aa-9961-ece6cd7c7b84	{"label": "Administrator"}	::1	2026-11-18 12:03:27.984
6a8b6f11-7b66-4d95-a4c1-771253ebdfff	\N	vault.deleted	credential	5ef8118d-4b5d-4976-adbb-4d6d391eb608	{"label": "Prod DB"}	::1	2026-11-18 12:03:27.999
efc05b33-5a3b-4e9c-8369-cad8548b271f	\N	sprint.created	project	4e827236-fd7a-4067-9fe3-9745fa808a69	{"sprint": "Sprint 2"}	\N	2026-11-18 12:03:25.974
43be25fb-4d14-4d15-af03-12ccd441f415	\N	workitem.created	work_item	37ab6201-0fc7-42db-8f7d-1767e377bc42	{"key": "PX400412-1"}	\N	2026-11-18 12:03:26.02
7583409c-7b28-4f0f-a72e-387da7cebda7	\N	workitem.created	work_item	c779547d-c946-4444-93af-fab06ff13c74	{"key": "PX400412-3"}	\N	2026-11-18 12:03:26.206
f88d6cc9-c93c-481b-b777-191451b6d542	\N	auth.invite_accepted	user	29229f3c-b536-41ed-90f4-7f1d2a048cb2	\N	\N	2026-11-18 12:03:23.248
20816a80-7f88-4f65-b57e-ef1c28da917f	\N	auth.login	user	29229f3c-b536-41ed-90f4-7f1d2a048cb2	{"method": "password"}	::1	2026-11-18 12:03:23.7
ba8fd190-4c1e-4ad7-9a72-d1c67d2e0641	\N	auth.invite_accepted	user	e564e883-e7ce-48a5-a39d-cfaf3c41063f	\N	\N	2026-11-18 12:03:24.412
cf1663c0-1a1b-4d73-b479-a300b7d9b5d3	\N	auth.invite_accepted	user	599a9082-6548-4566-b188-0dd40d310646	\N	\N	2026-11-18 12:03:25.328
06b9d399-f3c7-494a-9de0-f8b209235bd5	\N	auth.login	user	599a9082-6548-4566-b188-0dd40d310646	{"method": "password"}	::1	2026-11-18 12:03:25.767
41275ce9-b329-4bdf-866f-689f9d1da9d9	\N	vault.revealed	credential	841e748b-49f7-43d9-9121-efbd31c2492f	{"label": "Administrator"}	::1	2026-11-18 12:12:42.111
85338e42-e625-4d3f-9758-14c46345ab7b	\N	vault.deleted	credential	4522a901-3115-4631-a914-57f0b2e22e07	{"label": "Prod DB"}	::1	2026-11-18 12:12:42.128
044a928c-ba43-4db9-b2bf-2324092a1c6b	\N	sprint.completed	project	68109512-8d55-4a56-8df5-b643a9768fd2	{"moved": 2, "sprint": "Sprint 1"}	\N	2026-11-18 12:12:41.707
00b6d42c-b58d-4bb5-8a15-7d6d6cbb4a4a	\N	auth.invite_accepted	user	f757ee75-05f4-465c-972b-0aeef6922a32	\N	\N	2026-11-18 12:13:02.077
91d4169e-f0e6-491c-83bd-6e7ba8a653ec	\N	auth.login	user	f757ee75-05f4-465c-972b-0aeef6922a32	{"method": "password"}	::1	2026-11-18 12:13:02.526
44441660-76e9-440f-afb7-64fe68db83cd	\N	project.created	project	291c0a97-0e0b-4602-a6e5-dbe993552c68	{"key": "CPR"}	\N	2026-11-18 12:13:03.756
9e09fe4c-e5f0-47a3-af58-aed0985afd6b	\N	auth.invite_accepted	user	749d3ef0-3d86-459b-a719-6269e2878148	\N	\N	2026-11-18 12:12:37.285
08b074d2-db9a-458f-8e04-956c7c81b242	\N	auth.login	user	749d3ef0-3d86-459b-a719-6269e2878148	{"method": "password"}	::1	2026-11-18 12:12:37.721
aae6271a-1d06-40c0-84ab-32676b740b02	\N	auth.invite_accepted	user	dc48a963-b7dc-4663-9e5b-08fef1b5db52	\N	\N	2026-11-18 12:02:00.947
6d78d3bc-a974-43f4-b6bd-75abd7bdd98a	\N	auth.login	user	dc48a963-b7dc-4663-9e5b-08fef1b5db52	{"method": "password"}	::1	2026-11-18 12:02:01.402
a034e413-a985-4c3f-ad0e-20672ae598f7	\N	workitem.created	work_item	8cddf269-fc41-4124-9a0f-1a57fa126b19	{"key": "PX319139-1"}	\N	2026-11-18 12:02:05.226
12ebfdd6-55ff-4b68-874e-7d10109cadf4	\N	workitem.created	work_item	cbd3a34f-aa0c-4984-904e-a53000eead38	{"key": "PX319139-3"}	\N	2026-11-18 12:02:05.421
a1919189-300e-4b74-b981-fd45a9b60fde	\N	auth.login	user	627c3f47-1906-4bdf-91e8-9082639df4a2	{"method": "password"}	::1	2026-11-18 12:02:02.555
6552ce48-4274-4e59-8066-2e78569fbb66	\N	auth.invite_accepted	user	7c751f86-2d30-4533-8380-5aa598277d13	\N	\N	2026-11-18 12:12:39.334
3e436f3b-d77a-41e5-98de-b4f0b83b2c07	\N	auth.login	user	7c751f86-2d30-4533-8380-5aa598277d13	{"method": "password"}	::1	2026-11-18 12:12:39.77
91fb8f39-2e30-4b9a-bc09-49862d780e6c	\N	auth.invite_accepted	user	7af6dda2-cdb0-4632-9154-c6d4878fbeaf	\N	\N	2026-11-18 12:12:43.339
04760f61-ed7d-4341-b443-2f5fd8c31144	\N	auth.login	user	7af6dda2-cdb0-4632-9154-c6d4878fbeaf	{"method": "password"}	::1	2026-11-18 12:12:43.779
a9756a37-bbce-47d2-9907-3819c24000da	\N	workitem.deleted	work_item	bb9e70aa-ddc7-4111-baf4-d478ba0bc572	{"key": "E3962334-1", "title": "Customer self-service"}	\N	2026-11-18 12:12:48.051
9ff74e9a-9a15-41a9-b2f1-43442e892d1f	\N	workitem.created	work_item	bb9e70aa-ddc7-4111-baf4-d478ba0bc572	{"key": "E3962334-1"}	\N	2026-11-18 12:12:46.979
e1692c56-2eb8-4a62-a5c7-ee547eeaacee	\N	workitem.created	work_item	94a69dc4-0d36-4093-8999-1ee2116a8d43	{"key": "E3962334-3"}	\N	2026-11-18 12:12:47.039
1711e273-3fd3-4a47-89af-af4d8af8d320	\N	project.archived	project	98cbc59f-aa3d-41d8-8d58-d26f6ae90d19	\N	\N	2026-11-18 12:12:48.076
a6ba51c3-1f06-4f69-ad72-674820bb985d	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 12:12:35.186
e780954a-616c-489d-8d63-26ffa9e8452d	\N	workitem.created	work_item	30453675-afec-4b7e-8e2f-ee64a690b4de	{"key": "E3971691-5"}	\N	2026-11-18 08:52:59.175
1e36d692-65b5-4f34-b32c-93c2f227e18e	\N	workitem.deleted	work_item	008cdc9e-768d-47bc-91fc-1dbeabd2a650	{"key": "E3971691-1", "title": "Customer self-service"}	\N	2026-11-18 08:53:00.538
3f1adc20-b501-4fe2-8cc2-f5d0c85448e5	\N	workitem.created	work_item	97b176ab-1865-45dd-9733-af7e1d2c0bfb	{"key": "E3971691-6"}	\N	2026-11-18 08:52:59.412
14b71eb4-fb73-4542-9106-15dfe88919ae	28052739-2db0-422e-bb9e-07f3831f3121	project.created	project	98cbc59f-aa3d-41d8-8d58-d26f6ae90d19	{"key": "E3962334"}	\N	2026-11-18 12:12:42.864
3604a0d9-a8c4-41ab-9f4e-99bf007fcfe6	\N	sprint.created	project	68109512-8d55-4a56-8df5-b643a9768fd2	{"sprint": "Sprint 1"}	\N	2026-11-18 12:12:39.996
8e18514e-e41a-40c0-8ce4-ef80058cfc5e	\N	sprint.created	project	68109512-8d55-4a56-8df5-b643a9768fd2	{"sprint": "Sprint 2"}	\N	2026-11-18 12:12:40.021
74b9af9d-565d-4491-a128-bfc951506f85	\N	workitem.created	work_item	ece0e936-24c3-467c-8c75-63e2bf3e4d06	{"key": "PX319139-2"}	\N	2026-11-18 12:02:05.372
c82c6310-6e95-4f11-91c2-8b709734d69b	\N	workitem.created	work_item	6a017146-f5dd-4703-b717-a27da070797a	{"key": "E3962334-2"}	\N	2026-11-18 12:12:47.006
669fae52-6ed7-4f6a-9067-321d4a73777d	\N	workitem.created	work_item	88afc6da-bb61-4084-8b8f-a66519b21c47	{"key": "E3962334-4"}	\N	2026-11-18 12:12:47.078
d7e2d609-dca1-404a-b53e-c5936611dfcf	\N	workitem.created	work_item	7b4f519d-39e6-4d1d-996b-52c155d0620c	{"key": "E3962334-6"}	\N	2026-11-18 12:12:47.19
8227e52d-804d-48e7-865a-a04898e0dd03	\N	auth.invite_accepted	user	c98b94a1-83f8-48df-984c-1f3eb91c7707	\N	\N	2026-11-18 12:12:44.256
2560497e-1d97-4016-bc9e-19b23edaed86	\N	auth.login	user	c98b94a1-83f8-48df-984c-1f3eb91c7707	{"method": "password"}	::1	2026-11-18 12:12:44.699
1411c1f4-97ac-44bd-8c68-583247003d86	28052739-2db0-422e-bb9e-07f3831f3121	project.created	project	f65d4403-5cdd-4e9d-a174-eaad78dac225	{"key": "QA669770"}	\N	2026-11-18 13:47:50.517
0e2c42c8-c0e8-4f45-bacc-cde214cb2bbf	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	f65d4403-5cdd-4e9d-a174-eaad78dac225	{"role": "MEMBER", "userId": "9494163e-7c1b-406e-a979-72fd8f967c50"}	\N	2026-11-18 13:47:55.629
42221958-d9cb-4409-8f6a-e7a4d7e0e426	28052739-2db0-422e-bb9e-07f3831f3121	project.deleted	project	f65d4403-5cdd-4e9d-a174-eaad78dac225	{"key": "QA669770", "name": "Quasar Analytics 1795009669770"}	\N	2026-11-18 13:48:10.691
db210de3-1354-4762-909d-a7d90366c534	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 13:56:45.069
50db19cf-fca2-4d49-8958-da2d973246be	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	e050481e-39e6-4664-8836-40ecfd69be18	{"role": "EMPLOYEE"}	\N	2026-11-18 13:56:46.665
e28ad0a6-d4dc-4628-834f-c2be0a692114	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	d1172c6c-234b-42a5-ab1e-b26e2864c007	{"role": "MEMBER", "userId": "b5bbd2a3-6da0-42cb-ac66-ac3dcade450f"}	\N	2026-11-18 13:56:53.571
afcc14d0-3f27-4d36-87a2-4e75b1e7a0a6	28052739-2db0-422e-bb9e-07f3831f3121	project.deleted	project	d1172c6c-234b-42a5-ab1e-b26e2864c007	{"key": "QA204441", "name": "Quasar Analytics 1795010204441"}	\N	2026-11-18 13:57:04.089
3a27e1c2-fe01-427e-91c0-273339462c3e	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 13:57:05.83
b1cbd692-61af-47dc-8cfc-7ee62ed85fc3	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	751a86e0-8e5b-4fc9-8d8e-0f826272ed83	{"role": "EMPLOYEE"}	\N	2026-11-18 13:57:06.789
b33bf7b8-5c45-4f75-bef9-d9f898310de5	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	a377a25b-2d0d-4002-838c-6fa14275b817	{"role": "EMPLOYEE"}	\N	2026-11-18 13:57:08.851
06609f0e-2b77-4e75-8d0e-dd54d484aec2	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	df7e793f-f19a-4255-aaaa-545a2eed1112	{"role": "MANAGER", "userId": "d843b460-82a6-4b7a-ad3d-b193232b4eb9"}	\N	2026-11-18 13:57:10.019
ebd6e3ce-4b68-4a40-b5bf-57864000c1b4	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	df7e793f-f19a-4255-aaaa-545a2eed1112	{"role": "MEMBER", "userId": "751a86e0-8e5b-4fc9-8d8e-0f826272ed83"}	\N	2026-11-18 13:57:10.04
7dfd82fd-1518-4f80-9a7a-ebcf85e2c3a2	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	df7e793f-f19a-4255-aaaa-545a2eed1112	{"role": "VIEWER", "userId": "60ae430a-ae9b-4c9f-bbfb-f8d852bb799e"}	\N	2026-11-18 13:57:10.061
9b533547-e573-4a02-a1ad-85ca317b2a9c	\N	workitem.created	work_item	58f50a50-ca18-49f9-92ab-53c0577ee0ca	{"key": "QA669770-3"}	\N	2026-11-18 13:48:09.918
677ecf86-04d6-48b5-b750-120814a235e1	\N	sprint.created	project	f65d4403-5cdd-4e9d-a174-eaad78dac225	{"sprint": "Sprint V"}	\N	2026-11-18 13:48:10.009
31f89f66-335d-491c-af76-b8e4caa94dc3	\N	workitem.created	work_item	287b2c26-aeac-4067-a9d8-402e517a8961	{"key": "QA600074-2"}	\N	2026-11-18 13:46:58.922
8db4a4e8-d843-48cd-8888-523f01dd6c8a	\N	sprint.created	project	d4b3ca89-3790-42b3-a638-82357e824740	{"sprint": "Sprint V"}	\N	2026-11-18 13:46:59.112
8984d770-059c-469d-818d-c664865a01b1	\N	auth.invite_accepted	user	a377a25b-2d0d-4002-838c-6fa14275b817	\N	\N	2026-11-18 13:57:09.571
81b09332-bc0c-4ec7-86bb-3bf9e127611d	\N	auth.login	user	a377a25b-2d0d-4002-838c-6fa14275b817	{"method": "password"}	::1	2026-11-18 13:57:09.996
4a87ae06-5cf6-480d-8a8c-845f63ebb108	\N	auth.login	user	c8432a2f-7dae-4bf8-9631-99229ec60d45	{"method": "password"}	::1	2026-11-18 13:56:46.573
9daae8b1-62b6-49b4-ab52-bd575ff1b745	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	43574b5a-6adb-4855-aae0-7b64d78517db	{"role": "MANAGER"}	\N	2026-11-18 08:53:01.879
4d20146b-60ff-4ffd-82af-ed6b0ef74efa	28052739-2db0-422e-bb9e-07f3831f3121	project.created	project	68109512-8d55-4a56-8df5-b643a9768fd2	{"key": "PX954650"}	\N	2026-11-18 12:12:35.294
42c5eb47-189c-446f-aa37-dec7a4bfcfea	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	68109512-8d55-4a56-8df5-b643a9768fd2	{"role": "MEMBER", "userId": "749d3ef0-3d86-459b-a719-6269e2878148"}	\N	2026-11-18 12:12:39.832
c1a6b791-0b86-4ec6-b257-00e9a2b3a579	\N	project.updated	project	fa253a85-a11d-4d81-93d2-f5b3217fa25d	{"fields": ["description", "status"]}	\N	2026-11-18 08:53:04.447
f7dff86f-866e-4a2e-8dce-f9df745c2241	\N	project.environment_updated	project	fa253a85-a11d-4d81-93d2-f5b3217fa25d	{"type": "DEV"}	\N	2026-11-18 08:53:04.582
926ab3cc-379b-4827-a730-ccf095caa5d8	\N	project.archived	project	fa253a85-a11d-4d81-93d2-f5b3217fa25d	\N	\N	2026-11-18 08:53:04.598
aef1fd92-9506-4605-bfea-027397f298bd	28052739-2db0-422e-bb9e-07f3831f3121	vault.revealed	credential	4522a901-3115-4631-a914-57f0b2e22e07	{"label": "Prod DB"}	::1	2026-11-18 12:12:41.886
2e08d584-cc16-454d-bbab-0b2e3572618f	28052739-2db0-422e-bb9e-07f3831f3121	vault.created	credential	841e748b-49f7-43d9-9121-efbd31c2492f	{"label": "Administrator", "projectId": "68109512-8d55-4a56-8df5-b643a9768fd2"}	::1	2026-11-18 12:12:42.055
f269f06f-bf96-4be6-a5fb-92169121b0c8	28052739-2db0-422e-bb9e-07f3831f3121	vault.imported	credential	\N	{"created": 2, "skipped": 1}	::1	2026-11-18 12:12:42.07
f24cb8f4-a49c-47ff-8ceb-5973d7b30b3a	28052739-2db0-422e-bb9e-07f3831f3121	project.deleted	project	68109512-8d55-4a56-8df5-b643a9768fd2	{"key": "PX954650", "name": "Phoenix Portal 1795003954650"}	\N	2026-11-18 12:12:42.175
b439f6fc-aad0-4589-ac67-7b6b51574f77	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 12:12:42.833
fea91c56-f78b-4325-82c3-d56a1f42f521	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 12:13:00.58
3fafdef0-4210-41b0-bca0-5480b731d7d4	\N	sprint.started	project	68109512-8d55-4a56-8df5-b643a9768fd2	{"sprint": "Sprint 1"}	\N	2026-11-18 12:12:40.412
a110752e-0619-4588-bad5-4c6422167120	\N	vault.created	credential	4522a901-3115-4631-a914-57f0b2e22e07	{"label": "Prod DB", "projectId": "68109512-8d55-4a56-8df5-b643a9768fd2"}	::1	2026-11-18 12:12:41.8
c8080a8a-64aa-44c7-a087-d5c824d33e25	\N	vault.revealed	credential	4522a901-3115-4631-a914-57f0b2e22e07	{"label": "Prod DB"}	::1	2026-11-18 12:12:41.837
333e3cb6-24e2-44c3-ab5d-7ea005a83469	\N	vault.rotated	credential	4522a901-3115-4631-a914-57f0b2e22e07	{"fields": []}	::1	2026-11-18 12:12:41.867
b9b57e8b-9a28-4a84-91a2-968324b07f70	\N	project.member_added	project	291c0a97-0e0b-4602-a6e5-dbe993552c68	{"role": "MEMBER", "userId": "435c3f81-7af3-4fc0-8bda-7a4e95c5826a"}	\N	2026-11-18 12:13:03.854
59e0369b-774e-422b-8c1f-0f6698149c24	\N	project.environment_added	project	291c0a97-0e0b-4602-a6e5-dbe993552c68	{"type": "DEV"}	\N	2026-11-18 12:13:03.979
63fa0ca6-58ea-4b55-adb7-b0c5636d8bfb	\N	project.environment_updated	project	291c0a97-0e0b-4602-a6e5-dbe993552c68	{"type": "DEV"}	\N	2026-11-18 12:13:04.015
e6c0b814-8363-4280-a8a1-47f29705c155	\N	project.archived	project	291c0a97-0e0b-4602-a6e5-dbe993552c68	\N	\N	2026-11-18 12:13:04.033
aefa3904-c24c-4e4c-9b94-ed569a6877de	\N	sprint.completed	project	94da1a6d-0efb-44ea-b5b9-c89e4e7e288f	{"moved": 2, "sprint": "Sprint 1"}	\N	2026-11-18 12:02:06.826
ae50f1fa-0bf7-4ea3-8932-b78ad988e70b	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 13:46:40.674
b349b5ce-e5a2-477f-9f75-cd61ae9f67ad	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	11cc269c-bfc2-4d66-b56f-30354f692a8a	{"role": "MANAGER"}	\N	2026-11-18 13:46:41.17
c55e6f03-2a70-4337-bf74-f7fd0dffa7be	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	657ea570-12d1-4c7c-96fb-6cd2ab66f7c6	{"role": "EMPLOYEE"}	\N	2026-11-18 13:46:43.19
fbf0994e-5acb-4b3d-a6c1-ca535c1dfdfd	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	fdd90a33-7230-45a4-b081-f0a3a4ce3b28	{"role": "EMPLOYEE"}	\N	2026-11-18 13:46:44.047
01c6dea6-cfd4-4760-8077-bcaf01fd4f96	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	d4b3ca89-3790-42b3-a638-82357e824740	{"role": "MANAGER", "userId": "11cc269c-bfc2-4d66-b56f-30354f692a8a"}	\N	2026-11-18 13:46:45.122
26fd8b39-8d42-4e9b-94a5-8f72155b23ed	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	647d5364-4331-4832-b45f-78f2e40bf114	{"role": "MANAGER"}	\N	2026-11-18 13:47:50.644
4c8e03c5-2113-4080-9194-998aa7dd6241	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	179edead-cc0b-4fcc-bae0-9b5a04bf4130	{"role": "EMPLOYEE"}	\N	2026-11-18 13:47:54.274
cfa0feca-a362-41f9-9118-8bf360bebdef	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	f65d4403-5cdd-4e9d-a174-eaad78dac225	{"role": "MANAGER", "userId": "647d5364-4331-4832-b45f-78f2e40bf114"}	\N	2026-11-18 13:47:55.588
4bafa108-fab5-4bab-9a97-23e6c391ed9e	\N	workitem.created	work_item	431b0bc7-405e-488c-80e1-3f6edb57f8e8	{"key": "QA669770-1"}	\N	2026-11-18 13:47:55.704
c3681980-8a8a-44f1-8848-922ddc892193	\N	sprint.completed	project	f65d4403-5cdd-4e9d-a174-eaad78dac225	{"moved": 0, "sprint": "Sprint V"}	\N	2026-11-18 13:48:10.249
e0722ed8-6cfe-4e87-bca9-04c5b31918ea	\N	auth.invite_accepted	user	845717b8-e65d-4e12-acd3-a71a1a676f41	\N	\N	2026-11-18 13:47:53.802
77a1cada-68a7-464f-bce4-cc722b43ac71	\N	auth.invite_accepted	user	179edead-cc0b-4fcc-bae0-9b5a04bf4130	\N	\N	2026-11-18 13:47:54.975
c8fcb6d6-dc71-4323-95e8-2a806ff9e8ea	\N	auth.login	user	179edead-cc0b-4fcc-bae0-9b5a04bf4130	{"method": "password"}	::1	2026-11-18 13:47:55.491
61bc899f-52cc-46b3-9ba8-4a173c0758d4	\N	auth.login	user	11cc269c-bfc2-4d66-b56f-30354f692a8a	{"method": "password"}	::1	2026-11-18 13:46:42.046
a728e6f4-0848-490a-adea-dda9986e2a86	\N	workitem.created	work_item	d34f976e-322d-4033-abf3-d3ac69a7e68f	{"key": "QA600074-3"}	\N	2026-11-18 13:46:59.024
aee69822-d3a8-48fc-beac-6cbc12e142b6	\N	sprint.started	project	d4b3ca89-3790-42b3-a638-82357e824740	{"sprint": "Sprint V"}	\N	2026-11-18 13:46:59.194
6eee5dbb-5430-479a-9f5c-2c55c76ce408	\N	sprint.completed	project	d4b3ca89-3790-42b3-a638-82357e824740	{"moved": 1, "sprint": "Sprint V"}	\N	2026-11-18 13:46:59.286
3fc88db4-f200-48a6-8c8c-f01b41334bdc	\N	auth.invite_accepted	user	657ea570-12d1-4c7c-96fb-6cd2ab66f7c6	\N	\N	2026-11-18 13:46:43.611
1852235b-985a-4323-ac44-c6302e13b945	\N	auth.invite_accepted	user	fdd90a33-7230-45a4-b081-f0a3a4ce3b28	\N	\N	2026-11-18 13:46:44.682
489322a5-e3b6-455f-aa19-85e02d5967bd	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 12:03:21.009
60d08055-80d0-457d-ba12-5eabedcf28b2	28052739-2db0-422e-bb9e-07f3831f3121	project.deleted	project	fa253a85-a11d-4d81-93d2-f5b3217fa25d	{"key": "CPR", "name": "Customer Portal Revamp"}	\N	2026-11-18 08:53:04.656
fdd0dbd0-2641-47c9-82e6-a5ef9e2864fe	\N	auth.login	user	43574b5a-6adb-4855-aae0-7b64d78517db	{"method": "password"}	::1	2026-11-18 08:53:02.816
d0aee78c-e10e-4b65-8082-dc3673b9dc47	\N	auth.login	user	15452582-42be-482f-a79d-af2a4fb03a8d	{"method": "password"}	::1	2026-11-18 08:53:03.954
0617b6f4-897a-48b7-9e55-ebae7e907e41	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	7d446402-81ae-4895-b05e-1d18d9915833	{"role": "MANAGER"}	\N	2026-11-18 12:12:35.422
cde9db59-7395-43bb-9cbc-7f66c230de21	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	f569f564-e465-4299-b737-429c5c1ebd5d	{"role": "EMPLOYEE"}	\N	2026-11-18 12:12:37.748
dbfac7b7-f6ed-40a2-a5c8-12b7f1f48a0e	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	68109512-8d55-4a56-8df5-b643a9768fd2	{"role": "MANAGER", "userId": "7d446402-81ae-4895-b05e-1d18d9915833"}	\N	2026-11-18 12:12:39.804
94fd103c-4989-44a8-8a04-cc4573459573	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	f757ee75-05f4-465c-972b-0aeef6922a32	{"role": "MANAGER"}	\N	2026-11-18 12:13:01.34
8274c911-7767-4760-b5f7-65daf7d792fc	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	435c3f81-7af3-4fc0-8bda-7a4e95c5826a	{"role": "EMPLOYEE"}	\N	2026-11-18 12:13:02.555
48b73325-1573-4882-88b4-2cbfc97624c4	\N	sprint.created	project	4e827236-fd7a-4067-9fe3-9745fa808a69	{"sprint": "Sprint 1"}	\N	2026-11-18 12:03:25.947
a7dd3bff-65f1-4d69-b5e0-bbf08b04f313	\N	auth.invite_accepted	user	7d446402-81ae-4895-b05e-1d18d9915833	\N	\N	2026-11-18 12:12:36.085
d11a9bb5-20b7-4173-a716-b87d2ec5f5ff	\N	auth.login	user	7d446402-81ae-4895-b05e-1d18d9915833	{"method": "password"}	::1	2026-11-18 12:12:36.547
ecbfca55-5535-4903-84e3-37fc80d1e0af	\N	workitem.created	work_item	73cbd883-a7e4-42ca-9a31-5ecd95fce2fa	{"key": "PX954650-1"}	\N	2026-11-18 12:12:40.081
ed8e9127-84a0-49d5-b70b-7b5630a0633f	\N	auth.invite_accepted	user	f569f564-e465-4299-b737-429c5c1ebd5d	\N	\N	2026-11-18 12:12:38.187
59d46e28-c155-4249-af89-876ccf90fe4c	\N	auth.login	user	f569f564-e465-4299-b737-429c5c1ebd5d	{"method": "password"}	::1	2026-11-18 12:12:38.626
3df6e691-b540-4414-94dd-2055d2e9bb0f	\N	auth.invite_accepted	user	435c3f81-7af3-4fc0-8bda-7a4e95c5826a	\N	\N	2026-11-18 12:13:03.256
d0923f29-71cb-4ccc-ad6b-c41dad2eed13	\N	auth.login	user	435c3f81-7af3-4fc0-8bda-7a4e95c5826a	{"method": "password"}	::1	2026-11-18 12:13:03.702
b9c61b4e-d55b-4790-945d-071a16df2913	\N	workitem.created	work_item	955df7d4-84ff-4cff-b9c1-bd179fc0517e	{"key": "E3962334-5"}	\N	2026-11-18 12:12:47.106
523966bd-bcb2-4e1c-b4ed-9e2c006c0096	28052739-2db0-422e-bb9e-07f3831f3121	project.created	project	d4b3ca89-3790-42b3-a638-82357e824740	{"key": "QA600074"}	\N	2026-11-18 13:46:40.932
8d5010fb-7d89-4323-b944-e20a5c5e6bbb	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	d4b3ca89-3790-42b3-a638-82357e824740	{"role": "MEMBER", "userId": "fdd90a33-7230-45a4-b081-f0a3a4ce3b28"}	\N	2026-11-18 13:46:49.201
136087b6-3329-4e5e-b89c-79fbd85cb0f1	28052739-2db0-422e-bb9e-07f3831f3121	report.portfolio_exported	project	\N	{"count": 9}	\N	2026-11-18 13:46:59.403
132d2387-7641-4655-b083-77281a202f2a	28052739-2db0-422e-bb9e-07f3831f3121	project.archived	project	d4b3ca89-3790-42b3-a638-82357e824740	\N	\N	2026-11-18 13:46:59.611
5fd4d68b-f981-49ff-b88d-52d4ebd34f32	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	845717b8-e65d-4e12-acd3-a71a1a676f41	{"role": "EMPLOYEE"}	\N	2026-11-18 13:47:53.341
127d7606-d078-4bf7-bc18-38663a996798	28052739-2db0-422e-bb9e-07f3831f3121	report.portfolio_exported	project	\N	{"count": 9}	\N	2026-11-18 13:48:10.403
b339a4e1-38e0-4f32-9b06-460612d5a668	28052739-2db0-422e-bb9e-07f3831f3121	project.created	project	d1172c6c-234b-42a5-ab1e-b26e2864c007	{"key": "QA204441"}	\N	2026-11-18 13:56:45.329
dfd928bc-81b6-4a00-97c7-c2eefc4ff628	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	23754eab-1085-416f-86ea-5d7edcf9c4a3	{"role": "EMPLOYEE"}	\N	2026-11-18 13:56:47.766
5b4a2a2f-8034-4c6d-b7d0-c584c8a7ce96	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	d1172c6c-234b-42a5-ab1e-b26e2864c007	{"role": "MEMBER", "userId": "e050481e-39e6-4664-8836-40ecfd69be18"}	\N	2026-11-18 13:56:49.805
9a11f05d-5b27-46a4-bffd-95e23b0be414	28052739-2db0-422e-bb9e-07f3831f3121	report.portfolio_exported	project	\N	{"count": 9}	\N	2026-11-18 13:57:03.873
f8460c1d-f7ec-4ffe-892f-007862882d1c	28052739-2db0-422e-bb9e-07f3831f3121	project.archived	project	d1172c6c-234b-42a5-ab1e-b26e2864c007	\N	\N	2026-11-18 13:57:04.058
90c2b9e1-1a23-4f26-8d28-f11a28aee97a	28052739-2db0-422e-bb9e-07f3831f3121	project.created	project	df7e793f-f19a-4255-aaaa-545a2eed1112	{"key": "PX225370"}	\N	2026-11-18 13:57:05.861
e241944c-fd3d-4d8d-9dc6-d93fb5e724b6	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	d843b460-82a6-4b7a-ad3d-b193232b4eb9	{"role": "MANAGER"}	\N	2026-11-18 13:57:05.885
bf76a4fa-a681-426b-86b1-b26188f559e0	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	60ae430a-ae9b-4c9f-bbfb-f8d852bb799e	{"role": "EMPLOYEE"}	\N	2026-11-18 13:57:07.72
e1239c0d-1bfa-4a2e-8a58-bc8fe7813ea6	\N	auth.invite_accepted	user	647d5364-4331-4832-b45f-78f2e40bf114	\N	\N	2026-11-18 13:47:51.476
06e22a22-8a18-42a7-866d-ed3ad1696c13	\N	auth.invite_accepted	user	60ae430a-ae9b-4c9f-bbfb-f8d852bb799e	\N	\N	2026-11-18 13:57:08.385
009e6f46-f6a4-47b5-b48d-793fbee4e086	\N	auth.login	user	60ae430a-ae9b-4c9f-bbfb-f8d852bb799e	{"method": "password"}	::1	2026-11-18 13:57:08.814
0cca5e43-96c4-47c9-9726-6e8f3f9883ce	\N	workitem.created	work_item	4da38f12-34e4-4488-91b5-bb0390cf34cc	{"key": "QA600074-4"}	\N	2026-11-18 13:46:59.14
91149120-7395-4e4a-a8aa-c5816f9c1c57	\N	report.project_exported	project	d4b3ca89-3790-42b3-a638-82357e824740	\N	\N	2026-11-18 13:46:59.559
b7d0d3a5-9a85-48bf-8807-67576ce606dc	\N	workitem.created	work_item	5b70e803-f415-4b20-a725-046192d607a8	{"key": "QA204441-1"}	\N	2026-11-18 13:56:49.892
95b10793-c052-4273-90b6-846e2920340a	\N	workitem.created	work_item	81180b7a-5a95-4bef-8bb8-58c441d8c200	{"key": "QA204441-4"}	\N	2026-11-18 13:57:03.655
1fbaf398-319f-46db-859c-4742aa5df2fa	\N	report.project_exported	project	d1172c6c-234b-42a5-ab1e-b26e2864c007	\N	\N	2026-11-18 13:57:04.002
c293b59a-d070-485d-9f21-d096caa2488d	\N	auth.invite_accepted	user	23754eab-1085-416f-86ea-5d7edcf9c4a3	\N	\N	2026-11-18 13:56:48.202
8f4d4f68-81e3-46fd-a00e-16168b07f0d4	\N	auth.login	user	23754eab-1085-416f-86ea-5d7edcf9c4a3	{"method": "password"}	::1	2026-11-18 13:56:48.722
ffc3da6c-6414-47c0-bf15-9cc14a832064	28052739-2db0-422e-bb9e-07f3831f3121	project.exported	project	\N	{"count": 8, "format": "xlsx"}	\N	2026-11-18 08:53:04.678
4a10e114-e32a-443a-8606-06c73d80d336	28052739-2db0-422e-bb9e-07f3831f3121	project.exported	project	\N	{"count": 4, "format": "csv"}	\N	2026-11-18 08:53:04.732
17a83102-32a3-4509-9e43-0e1e55f54d29	28052739-2db0-422e-bb9e-07f3831f3121	category.created	category	cd114781-2e9d-47ce-a340-0f638d36594e	\N	\N	2026-11-18 08:53:04.777
e37fd838-6642-421d-aca7-dad961870fbd	28052739-2db0-422e-bb9e-07f3831f3121	category.deleted	category	cd114781-2e9d-47ce-a340-0f638d36594e	\N	\N	2026-11-18 08:53:04.788
9e991745-29d1-49d9-9cbb-ee4fa14d0272	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 08:53:19.437
f6ada3b0-e06d-479f-84eb-4fc3d0f5ebe4	28052739-2db0-422e-bb9e-07f3831f3121	auth.login_failed	user	28052739-2db0-422e-bb9e-07f3831f3121	\N	::1	2026-11-18 08:53:20.117
281acbe1-6c11-436f-80ea-490128579ae4	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 08:53:20.551
cb6a275c-fb89-4406-926e-eaf8c1cff8d6	28052739-2db0-422e-bb9e-07f3831f3121	project.created	project	4e827236-fd7a-4067-9fe3-9745fa808a69	{"key": "PX400412"}	\N	2026-11-18 12:03:21.161
15135cab-d843-4cca-af44-2ce2d75515f0	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	4e827236-fd7a-4067-9fe3-9745fa808a69	{"role": "MEMBER", "userId": "29229f3c-b536-41ed-90f4-7f1d2a048cb2"}	\N	2026-11-18 12:03:25.83
72537fed-e431-47c8-a0d2-5ca13d97ad06	28052739-2db0-422e-bb9e-07f3831f3121	user.role_changed	user	5c01eff0-2c20-42f9-b596-3e4101266613	{"to": "MANAGER", "from": "EMPLOYEE"}	\N	2026-11-18 08:53:27.274
59f51f19-978e-43f3-93d0-96e5af06368e	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	a678a8fe-8555-43a4-b370-48c3e498c7e8	{"role": "EMPLOYEE"}	\N	2026-11-18 08:53:27.859
bc555b24-0b06-4728-ac49-f03fb6e55803	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	749d3ef0-3d86-459b-a719-6269e2878148	{"role": "EMPLOYEE"}	\N	2026-11-18 12:12:36.586
65c30787-ab51-4954-95e3-e488074d7e7f	28052739-2db0-422e-bb9e-07f3831f3121	user.deactivated	user	a678a8fe-8555-43a4-b370-48c3e498c7e8	\N	\N	2026-11-18 08:53:29.931
7c5d53de-61a8-4cbe-8a8b-6c073d03269f	\N	auth.invite_accepted	user	9680d79f-6096-46d5-b8b3-1743cca3bc9a	\N	\N	2026-11-18 08:52:57.158
8754b08d-1b6b-4d11-8e27-b469c659b2c4	\N	auth.login	user	9680d79f-6096-46d5-b8b3-1743cca3bc9a	{"method": "password"}	::1	2026-11-18 08:52:57.591
a9895d39-afb2-4104-b973-9e02ad1a4ebc	\N	auth.invite_accepted	user	0984c808-6cc2-448e-9782-589cb3a7c98a	\N	\N	2026-11-18 08:52:58.055
ec681c78-ac83-4656-b296-ffe4843745a4	\N	auth.login	user	0984c808-6cc2-448e-9782-589cb3a7c98a	{"method": "password"}	::1	2026-11-18 08:52:58.488
2e290bb5-8461-4d44-bbc8-06c41464eeb3	\N	auth.invite_accepted	user	9f5708f2-e045-4e76-b815-7f090d73a3d0	\N	\N	2026-11-18 08:35:44.724
f88028d5-04dc-4fff-80a9-a960a698b1a0	\N	auth.login	user	9f5708f2-e045-4e76-b815-7f090d73a3d0	{"method": "password"}	::1	2026-11-18 08:35:45.132
69bf7e44-0927-4dde-bad5-c009ebd698ac	\N	workitem.created	work_item	489eeb22-132a-489e-aa86-1fe5314e7550	{"key": "E3943110-1"}	\N	2026-11-18 08:35:48.233
4051203e-f183-4a1c-9ebc-a587b1b228ad	\N	workitem.created	work_item	f2b4db8a-bc0d-419b-b239-da5139e771f2	{"key": "E3943110-2"}	\N	2026-11-18 08:35:48.366
5e98be87-19c6-4a22-9f93-b06c7fa12cbf	\N	workitem.created	work_item	2d17d018-5c0a-4899-95f6-557f2a7b4d52	{"key": "E3943110-3"}	\N	2026-11-18 08:35:48.416
e0465d89-cc82-41d3-9fea-00da9f818b60	\N	workitem.created	work_item	9da965fd-4cac-492d-9eb6-eaa99a45271d	{"key": "E3943110-4"}	\N	2026-11-18 08:35:48.451
69c2930b-5193-427e-b9c1-2d78f92d3de4	\N	workitem.created	work_item	2dfc93aa-ca62-4e92-bf14-c6e3665f4d6d	{"key": "E3943110-5"}	\N	2026-11-18 08:35:48.481
12459188-f1a6-4b0e-8adc-1f589c048782	\N	workitem.deleted	work_item	489eeb22-132a-489e-aa86-1fe5314e7550	{"key": "E3943110-1", "title": "Customer self-service"}	\N	2026-11-18 08:35:49.374
a676a6dd-737c-4509-a477-589afd791788	\N	project.archived	project	eacf6153-0085-4b43-baa9-5ef67a75b8e4	\N	\N	2026-11-18 08:35:49.4
9a2d9617-f81f-4547-939b-e2fdf11fa914	\N	auth.invite_accepted	user	d2ca5dbf-2bb2-4b29-bb48-5f735f8125c4	\N	\N	2026-11-18 08:35:45.83
c182c457-1e92-408d-888a-f23e3c31d476	\N	auth.login	user	d2ca5dbf-2bb2-4b29-bb48-5f735f8125c4	{"method": "password"}	::1	2026-11-18 08:35:46.239
850691c9-91f4-4522-8bee-a735ed513961	\N	workitem.created	work_item	8b372ca1-62a5-48fe-b45c-c3da1651e02d	{"key": "E3943110-6"}	\N	2026-11-18 08:35:48.552
f18f27bd-a779-46e6-bb44-c60249dd2de0	\N	auth.invite_accepted	user	081be336-7030-414a-be22-e643c66edeca	\N	\N	2026-11-18 08:35:46.685
efe3522f-9081-4f81-916a-7f8fad8fa44a	\N	auth.login	user	081be336-7030-414a-be22-e643c66edeca	{"method": "password"}	::1	2026-11-18 08:35:47.091
50c0e200-2493-4cf7-998e-49fecfd2fe4e	\N	user.register	user	5c01eff0-2c20-42f9-b596-3e4101266613	\N	::1	2026-11-18 08:53:21.031
50967d88-4d8a-4de4-9815-3b3bfdcf4ed0	\N	user.email_verified	user	5c01eff0-2c20-42f9-b596-3e4101266613	\N	\N	2026-11-18 08:53:21.508
b78339d1-4078-45a3-b2e2-65a3352d0509	\N	auth.login	user	5c01eff0-2c20-42f9-b596-3e4101266613	{"method": "password"}	::1	2026-11-18 08:53:21.945
e39a3b09-7f09-44ac-abe1-1eac02a19235	\N	auth.invite_accepted	user	39fd29fc-6096-4a44-8911-b649f2646a72	\N	\N	2026-11-18 08:35:47.604
b538383e-8b9b-4a90-bfb0-ae592553c105	\N	auth.login	user	39fd29fc-6096-4a44-8911-b649f2646a72	{"method": "password"}	::1	2026-11-18 08:35:48.012
d36332f7-1228-4ca6-a702-6b8663c5862b	\N	auth.invite_accepted	user	de390519-03b7-499d-9b3e-1ff714127d02	\N	\N	2026-11-18 08:52:54.476
8a1291c9-c07a-4458-b0f6-10adcd83fdbf	\N	auth.login	user	de390519-03b7-499d-9b3e-1ff714127d02	{"method": "password"}	::1	2026-11-18 08:52:54.974
409717c7-3d61-4fb1-a9e6-d07195540eca	\N	workitem.created	work_item	008cdc9e-768d-47bc-91fc-1dbeabd2a650	{"key": "E3971691-1"}	\N	2026-11-18 08:52:58.921
3d2a6038-9043-42a1-9f42-37ab8af99684	\N	auth.invite_accepted	user	da5b3348-466f-446d-bf75-d8e0551e64ef	\N	\N	2026-11-18 08:52:55.751
11fb10b5-cc41-4e94-b2b2-73df9ecb0a7a	\N	auth.login	user	da5b3348-466f-446d-bf75-d8e0551e64ef	{"method": "password"}	::1	2026-11-18 08:52:56.184
b470abaf-0bb2-47f9-b24c-2e2af116ce31	\N	auth.invite_accepted	user	a678a8fe-8555-43a4-b370-48c3e498c7e8	\N	\N	2026-11-18 08:53:28.384
5efafd58-f33c-473f-ad3b-da4707e574df	\N	auth.login	user	a678a8fe-8555-43a4-b370-48c3e498c7e8	{"method": "password"}	::1	2026-11-18 08:53:28.849
2df2aa69-aa67-476c-aa09-51e304db9dc0	\N	auth.password_reset_requested	user	a678a8fe-8555-43a4-b370-48c3e498c7e8	\N	\N	2026-11-18 08:53:28.863
e1bb1e57-a8d1-4b92-b894-feda7fe0bec2	\N	auth.password_reset	user	a678a8fe-8555-43a4-b370-48c3e498c7e8	\N	\N	2026-11-18 08:53:29.304
a38f8787-40be-4a03-9a17-e835b7b4a477	\N	auth.login	user	a678a8fe-8555-43a4-b370-48c3e498c7e8	{"method": "password"}	::1	2026-11-18 08:53:29.862
caf02a8f-ee38-4734-8c71-65967bc7a618	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	7c751f86-2d30-4533-8380-5aa598277d13	{"role": "EMPLOYEE"}	\N	2026-11-18 12:12:38.652
0fcd47e9-e505-4a45-b832-2afd62975747	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	c98b94a1-83f8-48df-984c-1f3eb91c7707	{"role": "EMPLOYEE"}	\N	2026-11-18 12:12:43.804
21356d13-43f2-4265-851f-6f33dfa5e2dc	28052739-2db0-422e-bb9e-07f3831f3121	vault.revealed	credential	67875c12-97d9-4f61-b179-7904193fddc5	{"label": "Prod DB"}	::1	2026-11-18 13:57:11.701
f0af406b-0665-427a-871c-b9e8f8b683ba	28052739-2db0-422e-bb9e-07f3831f3121	vault.created	credential	501eb8c0-0798-412b-8244-05ce73b3d1ca	{"label": "Administrator", "projectId": "df7e793f-f19a-4255-aaaa-545a2eed1112"}	::1	2026-11-18 13:57:11.922
c43f9dfa-65e5-4340-933d-c74f6b9035bc	28052739-2db0-422e-bb9e-07f3831f3121	vault.imported	credential	\N	{"created": 2, "skipped": 1}	::1	2026-11-18 13:57:11.94
c6e5fa73-ccb3-4233-9bda-c7db568beb73	\N	vault.created	credential	67875c12-97d9-4f61-b179-7904193fddc5	{"label": "Prod DB", "projectId": "df7e793f-f19a-4255-aaaa-545a2eed1112"}	::1	2026-11-18 13:57:11.633
c03596b8-df63-45a5-ac26-49e730193b54	\N	vault.revealed	credential	67875c12-97d9-4f61-b179-7904193fddc5	{"label": "Prod DB"}	::1	2026-11-18 13:57:11.669
deaf65cf-1645-4ecb-9179-ab205b4cbfe1	\N	vault.rotated	credential	67875c12-97d9-4f61-b179-7904193fddc5	{"fields": []}	::1	2026-11-18 13:57:11.689
8daf1f34-32c2-479e-9626-0c255012b188	28052739-2db0-422e-bb9e-07f3831f3121	vault.created	credential	0c8e4013-e7b6-4015-82b0-b7b7bb449e97	{"label": "Coordinator", "projectId": "df7e793f-f19a-4255-aaaa-545a2eed1112"}	::1	2026-11-18 13:57:11.94
484121f7-5123-497f-9228-0c956299401b	28052739-2db0-422e-bb9e-07f3831f3121	vault.imported	credential	\N	{"created": 0, "skipped": 3}	::1	2026-11-18 13:57:11.956
437181a7-6c9c-446e-9f6d-2e325f24dac5	28052739-2db0-422e-bb9e-07f3831f3121	project.archived	project	df7e793f-f19a-4255-aaaa-545a2eed1112	\N	\N	2026-11-18 13:57:12.006
0af169b3-c19a-4e00-a6ea-af22640ee16f	\N	vault.revealed	credential	501eb8c0-0798-412b-8244-05ce73b3d1ca	{"label": "Administrator"}	::1	2026-11-18 13:57:11.979
0af71b4f-c9b3-431a-9408-404e2c159048	\N	vault.deleted	credential	67875c12-97d9-4f61-b179-7904193fddc5	{"label": "Prod DB"}	::1	2026-11-18 13:57:11.992
b67887b7-5e71-4d1a-809e-d23f9798fa6b	28052739-2db0-422e-bb9e-07f3831f3121	project.deleted	project	df7e793f-f19a-4255-aaaa-545a2eed1112	{"key": "PX225370", "name": "Phoenix Portal 1795010225370"}	\N	2026-11-18 13:57:12.023
7f2af814-ca87-41ee-baef-0f5913f0795a	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 13:57:19.587
de52b5d9-0a80-4c24-bee7-8150c8ace452	28052739-2db0-422e-bb9e-07f3831f3121	project.created	project	872bc498-0885-491d-ae4b-04c4c146fce0	{"key": "E3238850"}	\N	2026-11-18 13:57:19.698
1328c16e-5b0e-44cb-b4fa-aecc0ae6dd03	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	81df349a-65af-4ce8-b5a4-1e938914b64c	{"role": "MANAGER"}	\N	2026-11-18 13:57:19.813
e2b7a0be-59df-4949-9ef3-6d04a556bedb	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	a4e726a9-015e-47d9-b810-4eaff1af7f4a	{"role": "EMPLOYEE"}	\N	2026-11-18 13:57:20.946
3ba086de-67b3-4902-bb53-1b7901a8d0b2	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	695274cc-7435-445f-a0b1-646f7825a1f7	{"role": "EMPLOYEE"}	\N	2026-11-18 13:57:22.155
13204ffe-8f7a-4c3c-8635-1d6f5cdf9912	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	300c8f5d-4cdf-4b81-9baf-ce66cf254808	{"role": "EMPLOYEE"}	\N	2026-11-18 13:57:23.032
1737caca-f671-40d7-9043-426fd3dd085e	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	872bc498-0885-491d-ae4b-04c4c146fce0	{"role": "MANAGER", "userId": "81df349a-65af-4ce8-b5a4-1e938914b64c"}	\N	2026-11-18 13:57:24.202
5a971aa6-5dc0-4e12-9555-4acbb12baac6	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	872bc498-0885-491d-ae4b-04c4c146fce0	{"role": "MEMBER", "userId": "a4e726a9-015e-47d9-b810-4eaff1af7f4a"}	\N	2026-11-18 13:57:24.24
752639a8-7c10-4136-8e96-e61bd205725b	28052739-2db0-422e-bb9e-07f3831f3121	project.member_added	project	872bc498-0885-491d-ae4b-04c4c146fce0	{"role": "VIEWER", "userId": "695274cc-7435-445f-a0b1-646f7825a1f7"}	\N	2026-11-18 13:57:24.266
17c0d5db-5e12-47b7-89b4-8c9fe37f0995	28052739-2db0-422e-bb9e-07f3831f3121	project.deleted	project	872bc498-0885-491d-ae4b-04c4c146fce0	{"key": "E3238850", "name": "E2E Phase3 1795010238850"}	\N	2026-11-18 13:57:26.487
f4f9ece8-8f89-4d88-8a92-56d1bf39bfc5	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 13:57:27.126
6f497803-5e7a-49f3-89f1-3f3eb0a2e826	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	6faf3ef2-98a0-47a4-8be6-b4e2b5651e5f	{"role": "MANAGER"}	\N	2026-11-18 13:57:27.466
b96f89cb-11d3-4979-9bd3-552725019f26	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	c4501cb4-1805-4d61-b9ec-c18853f8cb26	{"role": "EMPLOYEE"}	\N	2026-11-18 13:57:28.407
f5588cd7-b282-48dd-847d-16ddbf83ea39	28052739-2db0-422e-bb9e-07f3831f3121	project.deleted	project	65bb8fa1-ef62-4c64-9d43-79f9993c2a46	{"key": "CPR", "name": "Customer Portal Revamp"}	\N	2026-11-18 13:57:29.587
71cdc08f-b9cb-462d-b48e-2d2f9130176d	28052739-2db0-422e-bb9e-07f3831f3121	project.exported	project	\N	{"count": 8, "format": "xlsx"}	\N	2026-11-18 13:57:29.609
9a012cc4-4197-4903-83b2-3ab2762c5c47	28052739-2db0-422e-bb9e-07f3831f3121	project.exported	project	\N	{"count": 4, "format": "csv"}	\N	2026-11-18 13:57:29.668
ccf50bdf-f311-4fa9-b818-407ffddb6d60	28052739-2db0-422e-bb9e-07f3831f3121	category.created	category	750c7d01-843e-4eec-8a0b-cd0cf513b6f9	\N	\N	2026-11-18 13:57:29.72
39e68602-17d7-4975-80a8-7ec43eef8e33	28052739-2db0-422e-bb9e-07f3831f3121	category.deleted	category	750c7d01-843e-4eec-8a0b-cd0cf513b6f9	\N	\N	2026-11-18 13:57:29.729
81f5a79a-2878-40f9-9676-c378940378be	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 13:57:38.769
1edb2a74-f607-4fb9-ad39-eecdaee84fe1	\N	auth.invite_accepted	user	6328d053-b56c-4d04-b67c-fddf12fe0cba	\N	\N	2026-11-18 13:57:47.956
897f7a46-46ec-4574-9ecb-f3fef96ef062	\N	auth.invite_accepted	user	c4501cb4-1805-4d61-b9ec-c18853f8cb26	\N	\N	2026-11-18 13:57:28.838
64a97c44-f9b5-495e-b7d4-67d8431ff3cf	28052739-2db0-422e-bb9e-07f3831f3121	auth.login	user	28052739-2db0-422e-bb9e-07f3831f3121	{"method": "password"}	::1	2026-11-18 13:57:39.767
e5b47fd1-56a8-4245-88b0-09f64317244a	28052739-2db0-422e-bb9e-07f3831f3121	user.role_changed	user	910e4d85-2af6-458d-95d6-c7291d576024	{"to": "MANAGER", "from": "EMPLOYEE"}	\N	2026-11-18 13:57:46.562
9508a308-e53b-43c1-be98-ce6147283d89	28052739-2db0-422e-bb9e-07f3831f3121	user.invited	user	6328d053-b56c-4d04-b67c-fddf12fe0cba	{"role": "EMPLOYEE"}	\N	2026-11-18 13:57:47.218
391f02f0-c0d0-4394-9749-bf907ea9f8e7	28052739-2db0-422e-bb9e-07f3831f3121	user.deactivated	user	6328d053-b56c-4d04-b67c-fddf12fe0cba	\N	\N	2026-11-18 13:57:49.586
acfd9af0-72f4-4324-ac0b-65e20088fbcc	\N	auth.login	user	6328d053-b56c-4d04-b67c-fddf12fe0cba	{"method": "password"}	::1	2026-11-18 13:57:48.444
5302d216-ceed-4182-9be1-730f7bbff316	\N	auth.password_reset_requested	user	6328d053-b56c-4d04-b67c-fddf12fe0cba	\N	\N	2026-11-18 13:57:48.477
56b965ce-e1fd-4209-b2f9-4088589c1583	\N	auth.password_reset	user	6328d053-b56c-4d04-b67c-fddf12fe0cba	\N	\N	2026-11-18 13:57:49.027
19352a95-0f2a-45b1-9909-2fd3abe7a647	\N	auth.login	user	6328d053-b56c-4d04-b67c-fddf12fe0cba	{"method": "password"}	::1	2026-11-18 13:57:49.483
d48b3607-8f74-4473-96e7-cf887e04decb	\N	auth.login	user	c4501cb4-1805-4d61-b9ec-c18853f8cb26	{"method": "password"}	::1	2026-11-18 13:57:29.256
6ee31971-597d-42bb-a1f3-ad58ccd8412f	\N	sprint.completed	project	d1172c6c-234b-42a5-ab1e-b26e2864c007	{"moved": 0, "sprint": "Sprint V"}	\N	2026-11-18 13:57:03.764
1e1f7bb1-d68a-47d5-b03b-c1fc8d0c6553	\N	sprint.created	project	d1172c6c-234b-42a5-ab1e-b26e2864c007	{"sprint": "Sprint V"}	\N	2026-11-18 13:57:03.631
3233a43a-33f0-4779-8a5a-cb4294823928	\N	auth.invite_accepted	user	81df349a-65af-4ce8-b5a4-1e938914b64c	\N	\N	2026-11-18 13:57:20.491
ba96b87b-5da7-4247-a034-4b43b4e82e18	\N	auth.login	user	81df349a-65af-4ce8-b5a4-1e938914b64c	{"method": "password"}	::1	2026-11-18 13:57:20.908
5a330cbe-dcf9-44ca-9226-1471280a71f0	\N	workitem.created	work_item	54a8f1e8-3604-4435-95e8-8a552b6b798b	{"key": "E3238850-1"}	\N	2026-11-18 13:57:24.309
167547dd-9752-4d0d-9aa0-efbd75db8047	\N	workitem.created	work_item	ba03dce7-6c53-4709-a72b-8159fe3333ad	{"key": "E3238850-2"}	\N	2026-11-18 13:57:24.531
8f7e4b5e-e975-43b6-a112-8af313bae5db	\N	workitem.created	work_item	c283157d-59dd-4b92-b025-112916d75661	{"key": "E3238850-3"}	\N	2026-11-18 13:57:24.589
1753e3ed-dd42-45a1-9431-bc4303cb7014	\N	workitem.created	work_item	24e41ab8-01e1-4e6c-a20b-b5326afc3df6	{"key": "E3238850-4"}	\N	2026-11-18 13:57:24.626
e6e3f186-9f41-4566-81e6-ab937240ed7b	\N	workitem.created	work_item	3c1c26fa-9c88-4176-9b41-be0b2b93f325	{"key": "E3238850-5"}	\N	2026-11-18 13:57:24.669
9b121c8d-2120-438e-a52c-187564cd33dd	\N	workitem.deleted	work_item	54a8f1e8-3604-4435-95e8-8a552b6b798b	{"key": "E3238850-1", "title": "Customer self-service"}	\N	2026-11-18 13:57:26.391
38a644c1-628b-4efc-8220-7d467d8743e9	\N	project.archived	project	872bc498-0885-491d-ae4b-04c4c146fce0	\N	\N	2026-11-18 13:57:26.424
7b454eb9-95bc-400f-9664-ec6baff37481	\N	auth.invite_accepted	user	b5bbd2a3-6da0-42cb-ac66-ac3dcade450f	\N	\N	2026-11-18 13:56:49.199
9a411b42-9fcd-49aa-aafe-7f066c8c0793	\N	auth.login	user	b5bbd2a3-6da0-42cb-ac66-ac3dcade450f	{"method": "password"}	::1	2026-11-18 13:56:49.699
a03dd6ac-b2cc-412d-b478-16a62438addc	\N	auth.login	user	657ea570-12d1-4c7c-96fb-6cd2ab66f7c6	{"method": "password"}	::1	2026-11-18 13:46:44.021
777a90c5-24f6-439f-8e0c-d6c2edce3cba	\N	auth.invite_accepted	user	e050481e-39e6-4664-8836-40ecfd69be18	\N	\N	2026-11-18 13:56:47.307
fa3b8baf-7055-4c4e-9240-31a19c70cc6d	\N	auth.login	user	e050481e-39e6-4664-8836-40ecfd69be18	{"method": "password"}	::1	2026-11-18 13:56:47.734
ffd70e89-eb35-435f-a383-9bcc13bb0b36	\N	auth.login	user	fdd90a33-7230-45a4-b081-f0a3a4ce3b28	{"method": "password"}	::1	2026-11-18 13:46:45.089
45f01330-a565-4e3d-a63f-4d51e4facd22	\N	auth.invite_accepted	user	606bc8a8-c155-4d19-9613-00d9ded8c5d9	\N	\N	2026-11-18 13:46:42.747
f0abab48-488f-4fc9-a10a-648a7d8e4d71	\N	auth.login	user	606bc8a8-c155-4d19-9613-00d9ded8c5d9	{"method": "password"}	::1	2026-11-18 13:46:43.161
fcb38522-1a5b-458a-afc8-56352d97698f	\N	auth.invite_accepted	user	a4e726a9-015e-47d9-b810-4eaff1af7f4a	\N	\N	2026-11-18 13:57:21.679
6a72aebb-1c00-4542-ab8f-fefbed264a98	\N	auth.login	user	a4e726a9-015e-47d9-b810-4eaff1af7f4a	{"method": "password"}	::1	2026-11-18 13:57:22.117
d34f6aea-e436-4813-b9f5-20c90b838c99	\N	workitem.created	work_item	4656972e-c397-434c-9659-f128d4411986	{"key": "E3238850-6"}	\N	2026-11-18 13:57:24.744
dbac2073-3f4a-47b7-91ac-aa8d4268ebf3	\N	sprint.created	project	df7e793f-f19a-4255-aaaa-545a2eed1112	{"sprint": "Sprint 1"}	\N	2026-11-18 13:57:10.127
aa5f3700-c5eb-4b6b-bea3-17e5cbbbc589	\N	sprint.created	project	df7e793f-f19a-4255-aaaa-545a2eed1112	{"sprint": "Sprint 2"}	\N	2026-11-18 13:57:10.14
92ca1ee6-52e2-4474-8200-839663e52241	\N	workitem.created	work_item	edfe553e-4c58-45e9-b613-fc0646409211	{"key": "PX225370-1"}	\N	2026-11-18 13:57:10.166
a0c8a978-52dc-43e4-8332-36ade032d115	\N	workitem.created	work_item	99f19a3d-a007-49f1-8e5b-b575e912f887	{"key": "PX225370-2"}	\N	2026-11-18 13:57:10.204
ce221193-ec4e-4558-94e3-77df685fc302	\N	workitem.created	work_item	f1a31122-3548-4696-9f3e-4882c2ea60cf	{"key": "PX225370-3"}	\N	2026-11-18 13:57:10.239
f506ba9d-13f5-4d92-9f84-5b8e3cbc4736	\N	sprint.started	project	df7e793f-f19a-4255-aaaa-545a2eed1112	{"sprint": "Sprint 1"}	\N	2026-11-18 13:57:10.277
cc105fed-afe4-4372-af87-6c8a2be8ee05	\N	sprint.completed	project	df7e793f-f19a-4255-aaaa-545a2eed1112	{"moved": 2, "sprint": "Sprint 1"}	\N	2026-11-18 13:57:11.531
65efe50f-efbe-494e-9bca-c46519364392	\N	auth.invite_accepted	user	d843b460-82a6-4b7a-ad3d-b193232b4eb9	\N	\N	2026-11-18 13:57:06.329
da1ef278-1c76-4feb-9c69-436df27530fc	\N	auth.login	user	d843b460-82a6-4b7a-ad3d-b193232b4eb9	{"method": "password"}	::1	2026-11-18 13:57:06.757
9461bfd5-0676-4372-bafa-bca4f70ae1cf	\N	auth.invite_accepted	user	751a86e0-8e5b-4fc9-8d8e-0f826272ed83	\N	\N	2026-11-18 13:57:07.246
ba9531db-6727-4f2a-aa3b-cd28262f8fe6	\N	auth.login	user	751a86e0-8e5b-4fc9-8d8e-0f826272ed83	{"method": "password"}	::1	2026-11-18 13:57:07.695
b1388411-9462-43c9-abc5-987c7ac33c23	\N	auth.invite_accepted	user	695274cc-7435-445f-a0b1-646f7825a1f7	\N	\N	2026-11-18 13:57:22.578
5bbcf207-94a1-412f-8d81-89f17eb21c17	\N	auth.login	user	695274cc-7435-445f-a0b1-646f7825a1f7	{"method": "password"}	::1	2026-11-18 13:57:23.001
6ecb8d14-954e-467d-9c4f-d40423aadbfd	\N	auth.invite_accepted	user	300c8f5d-4cdf-4b81-9baf-ce66cf254808	\N	\N	2026-11-18 13:57:23.727
850972c9-522d-4c5f-b0f4-f8a49701a178	\N	auth.login	user	300c8f5d-4cdf-4b81-9baf-ce66cf254808	{"method": "password"}	::1	2026-11-18 13:57:24.166
86106df6-9577-4b59-a42e-0d4c73d2ad15	\N	user.register	user	910e4d85-2af6-458d-95d6-c7291d576024	\N	::1	2026-11-18 13:57:40.269
ecf3b03a-f940-4c3a-b8e1-5421f252d309	\N	user.email_verified	user	910e4d85-2af6-458d-95d6-c7291d576024	\N	\N	2026-11-18 13:57:40.784
ce9d650a-dac4-46f1-88b9-e3e93f5ee408	\N	auth.login	user	910e4d85-2af6-458d-95d6-c7291d576024	{"method": "password"}	::1	2026-11-18 13:57:41.251
31bd5c31-3253-4aba-9bd1-750e2aadc86b	\N	auth.invite_accepted	user	6faf3ef2-98a0-47a4-8be6-b4e2b5651e5f	\N	\N	2026-11-18 13:57:27.899
40906dcf-2674-4905-a36a-39a8642e90c9	\N	auth.login	user	6faf3ef2-98a0-47a4-8be6-b4e2b5651e5f	{"method": "password"}	::1	2026-11-18 13:57:28.381
e2b1cb26-84fe-4964-bede-d5195f9b561c	\N	project.created	project	65bb8fa1-ef62-4c64-9d43-79f9993c2a46	{"key": "CPR"}	\N	2026-11-18 13:57:29.338
f15d7d37-a035-43a3-bb2d-9d5dddb16f55	\N	project.member_added	project	65bb8fa1-ef62-4c64-9d43-79f9993c2a46	{"role": "MEMBER", "userId": "c4501cb4-1805-4d61-b9ec-c18853f8cb26"}	\N	2026-11-18 13:57:29.409
86b42d9e-3e30-4bc6-8644-4e7389e7a464	\N	project.updated	project	65bb8fa1-ef62-4c64-9d43-79f9993c2a46	{"fields": ["description", "status"]}	\N	2026-11-18 13:57:29.465
626d911e-9486-4ce0-8f1e-f9265812b1fe	\N	project.environment_added	project	65bb8fa1-ef62-4c64-9d43-79f9993c2a46	{"type": "DEV"}	\N	2026-11-18 13:57:29.483
29c66342-a62d-4124-9855-45a3c76ef823	\N	project.environment_updated	project	65bb8fa1-ef62-4c64-9d43-79f9993c2a46	{"type": "DEV"}	\N	2026-11-18 13:57:29.516
56f3ef11-f334-4c45-917d-89a1d25a4b23	\N	project.archived	project	65bb8fa1-ef62-4c64-9d43-79f9993c2a46	\N	\N	2026-11-18 13:57:29.532
\.


--
-- Data for Name: auth_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.auth_tokens (id, user_id, type, token_hash, expires_at, used_at, created_at) FROM stdin;
57cc818b-6445-4f98-8584-51c658b12178	24de9de0-731c-44a9-b155-675a0f5adfcf	INVITE	220013105f345451bfdd1d05e36e46c98d347ae51ec2a93ca0744bb7196664b3	2026-11-21 15:35:09.094	\N	2026-11-18 15:35:09.117
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (id, name, color, is_active, sort_order, created_at, updated_at) FROM stdin;
c059bc3b-228c-4a77-ad03-3964e323321f	AI Tool	#7c3aed	t	1	2026-11-18 08:13:45.812	2026-11-18 08:13:45.812
c2c5b6a1-a4c3-4753-9988-fd7a3229cf51	Web App	#2563eb	t	2	2026-11-18 08:13:45.825	2026-11-18 08:13:45.825
383c4119-634d-4331-be4b-c2fb9437388c	Website	#0891b2	t	3	2026-11-18 08:13:45.844	2026-11-18 08:13:45.844
3bc11efc-0820-4fc2-9342-6316728c09cb	Mobile	#059669	t	4	2026-11-18 08:13:45.848	2026-11-18 08:13:45.848
\.


--
-- Data for Name: comments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.comments (id, work_item_id, author_id, body, mentions, created_at, edited_at) FROM stdin;
\.


--
-- Data for Name: credentials; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.credentials (id, project_id, label, username, url, environment, notes, secret_ciphertext, secret_iv, secret_tag, key_version, created_by_id, updated_by_id, last_rotated_at, last_revealed_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: email_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.email_logs (id, "to", subject, template, status, error, created_at) FROM stdin;
b3263319-7ea8-41f0-b7f0-2e4a0b0e4f29	emp1794988969230@example.com	Verify your email for Project Tracker	verify-email	SENT	\N	2026-11-18 08:02:51.531
f4adfa3a-76ca-4f18-b9d7-482f16ba5ea5	emp1794988969230@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 08:02:52.041
bf1205c1-13b2-4671-b679-1180c0621eea	emp1794988969230@example.com	Your Project Tracker role was updated	role-changed	SENT	\N	2026-11-18 08:02:57.829
c80367d1-90d6-4baa-8159-84b90ea3535b	inv1794988969230@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 08:02:57.888
362503d2-d7ca-468d-a9d6-453405de2652	inv1794988969230@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 08:02:58.616
091d37b7-a498-4a8b-a423-cea1414054a8	inv1794988969230@example.com	Reset your Project Tracker password	password-reset	SENT	\N	2026-11-18 08:02:59.129
a704e237-6eba-4e03-830c-726130fe53c5	inv1794988969230@example.com	Your Project Tracker password was changed	password-changed	SENT	\N	2026-11-18 08:02:59.642
1ce486eb-9f80-4c63-81e2-368284beef9f	inv1794988969230@example.com	Your Project Tracker account was deactivated	account-deactivated	SENT	\N	2026-11-18 08:03:00.371
b60a1bde-4768-4195-9be7-c2a9fdbf8e73	mgr1794989671484@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 08:14:31.53
b0f36df7-cda1-437e-be77-c503922e611c	mgr1794989671484@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 08:14:32.198
3547a65f-be17-4126-8780-da50f1ae6b11	emp1794989672618@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 08:14:32.641
124c6f82-e084-46a2-abe2-255a92ebc110	emp1794989672618@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 08:14:33.314
b4ae6513-1520-4ea8-af7f-dd5b8508d666	emp1794989672618@example.com	You were added to CPR · Customer Portal Revamp	project-member-added	SENT	\N	2026-11-18 08:14:33.89
ae17e20b-84ba-4aac-bd5e-52fcfa2f1f73	emp1794990098236@example.com	Verify your email for Project Tracker	verify-email	SENT	\N	2026-11-18 08:21:40.833
581b2cd9-d9ad-4e44-889e-94084ee6a669	emp1794990098236@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 08:21:41.428
ac17a399-2f48-42b8-83a1-3134a1efd8cb	emp1794990098236@example.com	Your Project Tracker role was updated	role-changed	SENT	\N	2026-11-18 08:21:47.399
a077a4fd-8144-4f09-8123-d36bd6b7ecf8	inv1794990098236@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 08:21:47.467
1a9bcc0e-86fe-4e7c-b8d7-7bf486a6bde6	inv1794990098236@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 08:21:48.253
e9b954cf-7a1e-4afe-95ed-673708f2ce15	inv1794990098236@example.com	Reset your Project Tracker password	password-reset	SENT	\N	2026-11-18 08:21:48.8
5b477abf-da3c-4a2a-9744-262225815964	inv1794990098236@example.com	Your Project Tracker password was changed	password-changed	SENT	\N	2026-11-18 08:21:49.353
784867ed-b22e-48b9-bdab-296d2fe6f088	inv1794990098236@example.com	Your Project Tracker account was deactivated	account-deactivated	SENT	\N	2026-11-18 08:21:49.899
ea35c278-5764-4525-bb31-d3fa01105072	mgr1794990111259@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 08:21:51.308
1a2353ec-f898-46e7-a3aa-9218df227f0f	mgr1794990111259@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 08:21:52.112
8c13b228-3d0f-4f2b-8ff9-0130faf1cbb5	emp1794990112684@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 08:21:52.714
74d51045-a994-41d1-99e2-f77d257c44b9	emp1794990112684@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 08:21:53.477
24e350ad-c05c-4756-9508-5193b9f61b2b	emp1794990112684@example.com	You were added to CPR · Customer Portal Revamp	project-member-added	SENT	\N	2026-11-18 08:21:54.203
770eae41-21de-4fdd-a41c-1aff7e419234	emp1794990150057@example.com	Verify your email for Project Tracker	verify-email	SENT	\N	2026-11-18 08:22:32.51
e645d0c5-7174-490a-899a-45e5c1478459	emp1794990150057@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 08:22:33.027
83b1acbd-d9d8-4b78-a753-926014dd4cf8	emp1794990150057@example.com	Your Project Tracker role was updated	role-changed	SENT	\N	2026-11-18 08:22:38.771
7050d97a-dc88-4e4a-a7e7-b07c334b1aa7	inv1794990150057@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 08:22:39.369
82b9a2fe-2f94-45f0-8a7b-29e5a00c0dd8	inv1794990150057@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 08:22:40.134
4853a530-e2d0-475e-9d2e-1efdf7140c59	inv1794990150057@example.com	Reset your Project Tracker password	password-reset	SENT	\N	2026-11-18 08:22:40.653
5b31680a-ab35-42f6-8365-74ca7d772119	inv1794990150057@example.com	Your Project Tracker password was changed	password-changed	SENT	\N	2026-11-18 08:22:41.178
b1989f06-a3b1-4712-adc7-e3b81a4cc254	inv1794990150057@example.com	Your Project Tracker account was deactivated	account-deactivated	SENT	\N	2026-11-18 08:22:41.71
38b43188-6ed1-4531-b17a-0d07b58a2c74	e2emgr1794990943110@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 08:35:44.039
60365540-3817-4cc1-8316-5332ff2bae71	e2emgr1794990943110@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 08:35:44.727
335c708a-03ed-49b1-a631-845b8fe901fa	e2eemp1794990943110@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 08:35:45.171
7549e361-ec65-4457-af9c-3ff57f574b80	e2eemp1794990943110@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 08:35:45.832
df2c0093-d9a9-43bf-a09e-eb4686550af0	e2eview1794990943110@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 08:35:46.269
8047cbe8-30f8-4046-b7a5-5ba36073a6ab	e2eview1794990943110@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 08:35:46.687
c01a98d2-f481-4374-ba01-5aba2851e209	e2eout1794990943110@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 08:35:47.116
852d38f7-2a04-436e-9431-3181098ad4c7	e2eout1794990943110@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 08:35:47.606
a79976b9-6607-467d-b32a-742c5c804f3f	e2emgr1794990943110@example.com	You were added to E3943110 · E2E Phase3 1794990943110	project-member-added	SENT	\N	2026-11-18 08:35:48.053
c1ad0e01-e116-4c65-be0e-6733c245bf41	e2eemp1794990943110@example.com	You were added to E3943110 · E2E Phase3 1794990943110	project-member-added	SENT	\N	2026-11-18 08:35:48.104
a561f082-5479-497c-b36d-30fde3326727	e2eview1794990943110@example.com	You were added to E3943110 · E2E Phase3 1794990943110	project-member-added	SENT	\N	2026-11-18 08:35:48.165
6a13d4be-f0ee-420d-8c5e-f3dfc233b670	e2eemp1794990943110@example.com	[E3943110-3] assigned to you: As a user I can reset my password	work-item-assigned	SENT	\N	2026-11-18 08:35:48.42
8f420603-d920-4eed-af47-5b8bfbd68600	e2emgr1794990943110@example.com	emp user mentioned you on E3943110-5	mentioned	SENT	\N	2026-11-18 08:35:48.876
e0aff46d-fce0-4b6b-8eea-dc7fa6cc9a87	e2emgr1794991971691@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 08:52:53.765
f0bc1971-0f76-421d-901e-78e390875720	e2emgr1794991971691@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 08:52:54.479
c83bf47d-185a-4352-8c4e-c47b6d0a3a24	e2eemp1794991971691@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 08:52:55.038
ac08c960-8075-4421-86b0-d39a482b5533	e2eemp1794991971691@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 08:52:55.753
57a8c4f4-b4c1-4383-81c8-01c82a821cf7	e2eview1794991971691@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 08:52:56.216
b3c500a8-18b1-45e8-a345-f04cfff2c149	e2eview1794991971691@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 08:52:57.16
90dce33d-0fcf-4836-aae3-d2f540113757	e2eout1794991971691@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 08:52:57.63
2643a3fc-4601-4fbd-9060-185ba5329f1d	e2eout1794991971691@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 08:52:58.057
f4344a03-0694-4d2d-9731-3661ec6910af	e2emgr1794991971691@example.com	You were added to E3971691 · E2E Phase3 1794991971691	project-member-added	SENT	\N	2026-11-18 08:52:58.522
aa5ea0c0-5f6e-4762-8d24-281c7776efd0	e2eemp1794991971691@example.com	You were added to E3971691 · E2E Phase3 1794991971691	project-member-added	SENT	\N	2026-11-18 08:52:58.614
9c6edfd1-aadc-499b-885a-0b36c203e9b9	e2eview1794991971691@example.com	You were added to E3971691 · E2E Phase3 1794991971691	project-member-added	SENT	\N	2026-11-18 08:52:58.647
723a390a-a35c-427e-a104-78086509227d	e2eemp1794991971691@example.com	[E3971691-3] assigned to you: As a user I can reset my password	work-item-assigned	SENT	\N	2026-11-18 08:52:59.091
1761f0f7-c882-42e6-8f1d-e1dafd6630d8	e2emgr1794991971691@example.com	emp user mentioned you on E3971691-5	mentioned	SENT	\N	2026-11-18 08:52:59.914
d796845b-1b0a-478d-b816-c2b25c4c2809	emp1794991982831@example.com	You were added to CPR · Customer Portal Revamp	project-member-added	SENT	\N	2026-11-18 08:53:04.054
8c08ad71-e9b9-4e81-97f6-007b132cfc92	mgr1794991981587@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 08:53:01.881
8632d5af-aad1-44cd-a93b-75c996ad2b02	mgr1794991981587@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 08:53:02.401
58fb7ad9-d8b8-4044-b6b1-02ca886a603f	emp1794991982831@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 08:53:02.85
a7207ebf-17ae-4e30-95fd-a99af97b3189	emp1794991982831@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 08:53:03.54
0da677ee-bba0-4c7c-b8d5-6d0721699cd4	emp1794991998427@example.com	Verify your email for Project Tracker	verify-email	SENT	\N	2026-11-18 08:53:21.053
213957e1-a3af-4c82-8c77-0f2f4cb1a623	emp1794991998427@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 08:53:21.51
f026fb46-33b0-4746-85e5-867730d139ea	emp1794991998427@example.com	Your Project Tracker role was updated	role-changed	SENT	\N	2026-11-18 08:53:27.282
88675c21-b6c6-4d56-bbdb-6dada8e8e40e	inv1794991998427@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 08:53:27.861
33ce8a9e-a4a8-4ef2-b40b-252364bd064b	inv1794991998427@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 08:53:28.388
6b59b61b-f3de-4c41-a7b3-8d539cadf21f	inv1794991998427@example.com	Reset your Project Tracker password	password-reset	SENT	\N	2026-11-18 08:53:28.866
d2751244-04bc-4875-aee1-4435f3f57aad	inv1794991998427@example.com	Your Project Tracker password was changed	password-changed	SENT	\N	2026-11-18 08:53:29.306
ba6e2151-2feb-4a3a-8c97-c4bf1719e52d	inv1794991998427@example.com	Your Project Tracker account was deactivated	account-deactivated	SENT	\N	2026-11-18 08:53:29.933
9564ef87-3b9b-44c9-bcbe-aa0cc83bb06c	e2emgr1795003319139@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 12:02:00.21
dc14d6f8-e6dd-4224-8510-a41359af625b	e2emgr1795003319139@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 12:02:00.95
65c2029f-8677-46eb-95a0-aa98d5cd6504	e2eemp1795003319139@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 12:02:01.456
8010d9c1-958c-4d34-b73e-9556fa0c451b	e2eemp1795003319139@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 12:02:02.114
ddb5d3b0-ba7f-4a36-ab7f-d729e1bbf17e	e2eview1795003319139@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 12:02:02.595
ae2dde3b-fd5a-4524-9cde-505fc321330b	e2eview1795003319139@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 12:02:03.045
521b7afc-699a-406c-b6de-1762680c02cf	e2eout1795003319139@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 12:02:03.527
f98c1041-1cfc-40c2-a006-ceba18c5920f	e2eout1795003319139@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 12:02:04.381
ff70dae6-606f-4fb5-b74d-32e108701a1b	e2emgr1795003319139@example.com	You were added to PX319139 · Phoenix Portal 1795003319139	project-member-added	SENT	\N	2026-11-18 12:02:04.9
b9eb2de9-b60a-4d01-a44c-8b6bac5c6a68	e2eemp1795003319139@example.com	You were added to PX319139 · Phoenix Portal 1795003319139	project-member-added	SENT	\N	2026-11-18 12:02:04.929
c8dffb3f-b94e-4b65-8c04-7348cbb50acb	e2eview1795003319139@example.com	You were added to PX319139 · Phoenix Portal 1795003319139	project-member-added	SENT	\N	2026-11-18 12:02:05.029
c1c55bc6-e780-4dbc-a7d6-a28a036b4f22	e2eemp1795003319139@example.com	[PX319139-2] assigned to you: SSO callback	work-item-assigned	SENT	\N	2026-11-18 12:02:05.377
cb2ca0ba-79c2-43ce-b761-a97826ae750b	e2emgr1795003400412@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 12:03:21.329
82c70242-66a0-4c07-bef4-d7715cff3d49	e2emgr1795003400412@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 12:03:22.019
ba66e81b-9a78-4606-9602-471579a40e1d	e2eemp1795003400412@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 12:03:22.583
e91d6e0a-d9c3-44c3-a19c-fbeed2ae211b	e2eemp1795003400412@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 12:03:23.251
7e7e2359-fd9a-4223-8f51-df58c046bf29	e2eview1795003400412@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 12:03:23.733
d9a15720-a18a-494c-8dd7-5d8465e3431d	e2eview1795003400412@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 12:03:24.413
cde33b20-48c3-4388-aa54-a2784606861e	e2eout1795003400412@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 12:03:24.884
a769edfe-cfa4-4f8b-a9cc-c40048181438	e2eout1795003400412@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 12:03:25.33
6ce28847-aad2-4264-95e4-eacc8199a941	e2emgr1795003400412@example.com	You were added to PX400412 · Phoenix Portal 1795003400412	project-member-added	SENT	\N	2026-11-18 12:03:25.804
6c1e8690-0d0e-493a-8544-550b0e48d1f7	e2eemp1795003400412@example.com	You were added to PX400412 · Phoenix Portal 1795003400412	project-member-added	SENT	\N	2026-11-18 12:03:25.833
c94bd437-2a26-45b9-9c0f-158217041114	e2eview1795003400412@example.com	You were added to PX400412 · Phoenix Portal 1795003400412	project-member-added	SENT	\N	2026-11-18 12:03:25.865
38d677a8-fa35-4344-8cd2-f9d1da14ce91	e2eemp1795003400412@example.com	[PX400412-2] assigned to you: SSO callback	work-item-assigned	SENT	\N	2026-11-18 12:03:26.162
000167b5-2912-41f8-acce-3e751cc7b950	e2emgr1795003954650@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 12:12:35.428
6ebae15a-4f8d-4d4a-9dde-1a2605da9b10	e2emgr1795003954650@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 12:12:36.5
53d9782c-d83b-4c96-aa50-fffec52a8914	e2eemp1795003954650@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 12:12:36.589
c3f85a3b-3f62-4d0d-9f4b-a8798aded45f	e2eemp1795003954650@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 12:12:37.288
d37f053a-197f-410f-8011-bbd7aba8906d	e2eview1795003954650@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 12:12:37.75
495d88ae-3843-4c43-ae8a-ff0c1e564231	e2eview1795003954650@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 12:12:38.189
504c0315-786b-4e4b-9c35-5cbcc6d417b4	e2eout1795003954650@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 12:12:38.654
51fecb96-3023-4377-8fcb-1921d4ce9b5a	e2eout1795003954650@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 12:12:39.336
8a2d1aa4-c320-4e59-878d-c1e1cc57c4ca	e2emgr1795003954650@example.com	You were added to PX954650 · Phoenix Portal 1795003954650	project-member-added	SENT	\N	2026-11-18 12:12:39.808
445d0b18-ef5d-4532-a682-92b40bee928f	e2eemp1795003954650@example.com	You were added to PX954650 · Phoenix Portal 1795003954650	project-member-added	SENT	\N	2026-11-18 12:12:39.836
853a3011-c739-4ba3-8b18-733a95088479	e2eview1795003954650@example.com	You were added to PX954650 · Phoenix Portal 1795003954650	project-member-added	SENT	\N	2026-11-18 12:12:39.916
e86d5771-461f-425a-9aaf-f0648488a807	e2eemp1795003954650@example.com	[PX954650-2] assigned to you: SSO callback	work-item-assigned	SENT	\N	2026-11-18 12:12:40.253
9b267fc4-ea40-47aa-beea-96281d47cf5e	e2emgr1795003962334@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 12:12:42.892
39dfa2eb-d11c-413a-bbc6-5e4fa60755de	e2emgr1795003962334@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 12:12:43.342
998cfbf0-6763-4836-8986-9e715bdb7efd	e2eemp1795003962334@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 12:12:43.806
a74b109b-63ae-4ad8-b410-01607264a5c7	e2eemp1795003962334@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 12:12:44.258
0355dc28-8531-4ef4-9838-398204898a0b	e2eview1795003962334@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 12:12:44.73
c6334d8a-5f4b-456b-9f8e-003faa3281ba	e2eview1795003962334@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 12:12:45.261
874547f5-fb9d-44af-acdd-bf47ff373fc8	e2eout1795003962334@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 12:12:45.717
a7e3ede1-d0d5-469a-bb35-537ebf30b053	e2eout1795003962334@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 12:12:46.443
685d928f-c8a1-445a-9c13-4f21341b67a4	e2emgr1795003962334@example.com	You were added to E3962334 · E2E Phase3 1795003962334	project-member-added	SENT	\N	2026-11-18 12:12:46.917
fa00aa35-b16a-4435-9754-005e8101ff2d	e2eemp1795003962334@example.com	You were added to E3962334 · E2E Phase3 1795003962334	project-member-added	SENT	\N	2026-11-18 12:12:46.938
ea2b9c88-a206-4c12-bab7-62da4ffd8ef4	e2eview1795003962334@example.com	You were added to E3962334 · E2E Phase3 1795003962334	project-member-added	SENT	\N	2026-11-18 12:12:46.959
ec35a361-b26b-41e0-a978-541ee74376c7	e2emgr1795003962334@example.com	emp user mentioned you on E3962334-5	mentioned	SENT	\N	2026-11-18 12:12:47.458
b376aea1-1dfc-4069-a76c-012820a4514a	e2eemp1795003962334@example.com	[E3962334-3] assigned to you: As a user I can reset my password	work-item-assigned	SENT	\N	2026-11-18 12:12:47.041
4ec8b40b-02bf-4881-b8f6-ed5006966521	mgr1795003981292@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 12:13:01.344
e84a348d-2ead-4c2b-9d94-cc4b71202a12	mgr1795003981292@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 12:13:02.08
710ed267-c6e9-4115-9811-9567058a698f	emp1795003982541@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 12:13:02.558
ba273d9e-11a1-4cee-a8bf-d4fe03155e95	emp1795003982541@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 12:13:03.259
0bb96c3c-5510-4886-a7e4-409b6480f3dd	emp1795003982541@example.com	You were added to CPR · Customer Portal Revamp	project-member-added	SENT	\N	2026-11-18 12:13:03.857
4b92762b-14a1-479d-b961-aae46658534c	emp1795003984412@example.com	Verify your email for Project Tracker	verify-email	SENT	\N	2026-11-18 12:13:06.448
28ec6acd-97cf-48d5-ac67-001399776197	emp1795003984412@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 12:13:06.914
13689196-12cc-406a-9756-fd6e083d666d	emp1795003984412@example.com	Your Project Tracker role was updated	role-changed	SENT	\N	2026-11-18 12:13:12.67
b1971586-73c3-4ed3-8620-3f4be9749ae1	inv1795003984412@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 12:13:13.257
2b629db8-9b88-442a-9824-40294b455643	inv1795003984412@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 12:13:13.725
ff995e5d-0352-4e28-9e71-77efcc5a0215	inv1795003984412@example.com	Reset your Project Tracker password	password-reset	SENT	\N	2026-11-18 12:13:14.266
ce6a1597-c005-4388-ad5b-5faf1667791d	inv1795003984412@example.com	Your Project Tracker password was changed	password-changed	SENT	\N	2026-11-18 12:13:14.722
84b26868-ef70-4a05-9468-6bb9f903e8e2	inv1795003984412@example.com	Your Project Tracker account was deactivated	account-deactivated	SENT	\N	2026-11-18 12:13:15.242
63a8f841-3c5d-49f8-9531-ab0bc95b4d62	e2emgr1795009600074@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 13:46:41.174
cc8e7e97-83b0-420e-b941-020434b2a76d	e2emgr1795009600074@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 13:46:41.638
1719694a-85e6-44ae-8465-1ef287c5727c	e2eemp1795009600074@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 13:46:42.08
05f16dc3-f1a6-4327-abe1-1b204cd7bf3c	e2eemp1795009600074@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 13:46:42.749
6a0c8b3e-42e5-40ca-97b6-68372af16038	e2eout1795009600074@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 13:46:43.192
061aae28-29db-41b7-9a57-4b57356d924e	e2eout1795009600074@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 13:46:44.018
26a21f50-5adc-4727-bf44-eb14096576e9	e2enew1795009600074@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 13:46:44.05
2d581dfd-1049-4b8e-adec-3d009e09427e	e2enew1795009600074@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 13:46:44.684
1c54820f-59f6-4b4f-af0e-6e56e38cc951	e2emgr1795009600074@example.com	You were added to QA600074 · Quasar Analytics 1795009600074	project-member-added	SENT	\N	2026-11-18 13:46:45.147
e321453a-6a52-4dbc-8d08-a075e429265b	e2eemp1795009600074@example.com	You were added to QA600074 · Quasar Analytics 1795009600074	project-member-added	SENT	\N	2026-11-18 13:46:45.2
98c18ec9-f569-4b2f-a460-50eb5b90bac5	e2eemp1795009600074@example.com	[QA600074-1] assigned to you: Tune the kumquat pipeline	work-item-assigned	SENT	\N	2026-11-18 13:46:45.564
6103e809-90c2-45f9-9c35-1f98112fdc11	e2emgr1795009600074@example.com	emp user mentioned you on QA600074-1	mentioned	SENT	\N	2026-11-18 13:46:46.35
b80342fb-9030-4e17-bde1-4446bee48925	e2eemp1795009600074@example.com	[QA600074-1] mgr user commented	commented	SENT	\N	2026-11-18 13:46:47.047
c0af60ee-a668-4d0d-8961-a3963d31cd7b	e2emgr1795009600074@example.com	[QA600074-1] emp user moved it to In Progress	state-changed	SENT	\N	2026-11-18 13:46:47.703
278096d2-21f1-4213-8931-0ed278b1d002	e2enew1795009600074@example.com	You were added to QA600074 · Quasar Analytics 1795009600074	project-member-added	SENT	\N	2026-11-18 13:46:49.216
cd359986-a26c-4724-be00-6859199efaf8	e2eemp1795009600074@example.com	[QA600074-1] Due tomorrow	due-soon	SENT	\N	2026-11-18 13:46:52.616
28b41412-5626-4bbe-9864-7d5e2f8afde7	e2eemp1795009600074@example.com	[QA600074-2] assigned to you: Crash on export	work-item-assigned	SENT	\N	2026-11-18 13:46:58.927
cf8c2e11-9255-4c57-a967-58eb5ebfe2d8	e2emgr1795009669770@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 13:47:50.648
2c7db0b0-4575-42a1-9e50-881b6dbcdef1	e2emgr1795009669770@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 13:47:51.48
1caae684-e5c7-4377-8199-180de238a7c1	e2eemp1795009669770@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 13:47:52.121
0d2594cf-3b9d-4ed7-bee6-0b447e0da5f2	e2eemp1795009669770@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 13:47:52.857
ab6f5380-6733-4522-9b98-e1109634b679	e2eout1795009669770@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 13:47:53.343
7b8dc92b-4532-45c3-818e-c4073b535634	e2eout1795009669770@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 13:47:53.804
e2dbcc1b-a2f6-4c39-870d-237061b53102	e2enew1795009669770@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 13:47:54.293
3ebd86a2-86ae-43d3-abaf-ad136efc1f62	e2enew1795009669770@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 13:47:55.388
028475cf-695b-4c91-a0b1-2fe8fa78f0ef	e2emgr1795009669770@example.com	You were added to QA669770 · Quasar Analytics 1795009669770	project-member-added	SENT	\N	2026-11-18 13:47:55.611
0ab77b76-3561-4df6-b317-d93176a48dd2	e2eemp1795009669770@example.com	You were added to QA669770 · Quasar Analytics 1795009669770	project-member-added	SENT	\N	2026-11-18 13:47:55.635
7323a150-cf4a-4212-bb2f-48af120b96c3	e2eemp1795009669770@example.com	[QA669770-1] assigned to you: Tune the kumquat pipeline	work-item-assigned	SENT	\N	2026-11-18 13:47:55.738
95a908c8-0989-4269-b584-daf590474d47	e2emgr1795009669770@example.com	emp user mentioned you on QA669770-1	mentioned	SENT	\N	2026-11-18 13:47:56.771
d3775232-e0d9-4ebc-ba47-a41068a7667a	e2eemp1795009669770@example.com	[QA669770-1] mgr user commented	commented	SENT	\N	2026-11-18 13:47:57.409
9f5fdee9-ac04-4b71-89b4-b6c768de3016	e2emgr1795009669770@example.com	[QA669770-1] emp user moved it to In Progress	state-changed	SENT	\N	2026-11-18 13:47:58.07
fb7f8254-1e9c-4d76-b941-984f2073b65e	e2enew1795009669770@example.com	You were added to QA669770 · Quasar Analytics 1795009669770	project-member-added	SENT	\N	2026-11-18 13:47:59.737
221f8725-f20f-4628-9187-8af7d499c8c3	e2eemp1795009669770@example.com	[QA669770-1] Due tomorrow	due-soon	SENT	\N	2026-11-18 13:48:03.215
8d822c48-848d-48a3-8650-9ab0714ff9ea	e2eemp1795009669770@example.com	[QA669770-2] assigned to you: Crash on export	work-item-assigned	SENT	\N	2026-11-18 13:48:09.851
03a0ed84-8011-463d-9da7-acdef5a7eacb	e2emgr1795010204441@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 13:56:45.458
cc46b562-79c3-45f2-abac-87d80f00b8c5	e2emgr1795010204441@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 13:56:46.531
00c5563a-4b1b-4802-a50e-e673f7c469fc	e2eemp1795010204441@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 13:56:46.668
363003aa-6ec1-47a4-abfa-04b368fd4d9e	e2eemp1795010204441@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 13:56:47.31
543a29eb-2bf5-4ce5-9f80-9ba92b292812	e2eout1795010204441@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 13:56:47.768
b3d08297-da80-4fdd-85d8-6981e9d0cabd	e2eout1795010204441@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 13:56:48.624
2c42aed1-e299-4761-8e42-9077c6ea4780	e2enew1795010204441@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 13:56:48.748
53f94e2e-bced-4b16-8865-c35611345e5c	e2enew1795010204441@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 13:56:49.201
ccae0eb5-14d2-4917-962e-40078ca280f6	e2emgr1795010204441@example.com	You were added to QA204441 · Quasar Analytics 1795010204441	project-member-added	SENT	\N	2026-11-18 13:56:49.782
9c7a892b-2e78-4d42-b617-1f577a57a532	e2eemp1795010204441@example.com	You were added to QA204441 · Quasar Analytics 1795010204441	project-member-added	SENT	\N	2026-11-18 13:56:49.815
9f2e3d26-7719-49d7-883e-1b2e6f7a663d	e2emgr1795010204441@example.com	[QA204441-1] emp user moved it to In Progress	state-changed	SENT	\N	2026-11-18 13:56:52.201
210ff3b7-9578-4f23-97f5-c3b2554609b1	e2enew1795010204441@example.com	You were added to QA204441 · Quasar Analytics 1795010204441	project-member-added	SENT	\N	2026-11-18 13:56:53.577
c4ccd724-ae80-4e6f-b4f4-6ee3d63e7a87	e2eview1795010225370@example.com	You were added to PX225370 · Phoenix Portal 1795010225370	project-member-added	SENT	\N	2026-11-18 13:57:10.069
4befcab2-5e46-4c7e-b11a-c6f733412114	e2emgr1795010225370@example.com	[PX225370-2] emp user moved it to In Progress	state-changed	SENT	\N	2026-11-18 13:57:10.899
aef195ec-3baf-4de1-a79e-935a5480c6cd	e2eemp1795010204441@example.com	[QA204441-1] assigned to you: Tune the kumquat pipeline	work-item-assigned	SENT	\N	2026-11-18 13:56:49.899
d14f0cf4-073f-4971-81ba-2570b60f68ee	e2emgr1795010204441@example.com	emp user mentioned you on QA204441-1	mentioned	SENT	\N	2026-11-18 13:56:50.85
5d252297-11d7-46d7-badc-cb0574a23d2b	e2eemp1795010204441@example.com	[QA204441-1] mgr user commented	commented	SENT	\N	2026-11-18 13:56:51.487
59cfd3d1-db10-4c9f-ab81-b4c6f969c14a	e2eemp1795010204441@example.com	[QA204441-1] Due tomorrow	due-soon	SENT	\N	2026-11-18 13:56:57.055
856cff7c-0575-4436-9df9-14dd89df38a1	e2eemp1795010204441@example.com	[QA204441-2] assigned to you: Crash on export	work-item-assigned	SENT	\N	2026-11-18 13:57:03.493
54ff363a-7349-414c-9849-2e87f0777466	e2emgr1795010225370@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 13:57:05.9
f9693736-6b8e-467b-a417-7cfc28302d77	e2emgr1795010225370@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 13:57:06.332
10dbdbd7-307c-44d3-a684-e1a97644d490	e2eemp1795010225370@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 13:57:06.791
f11e3edd-3236-452c-a8f9-583b87dc7d66	e2eemp1795010225370@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 13:57:07.248
949d284e-160e-47b7-87a5-f36d4f7e08aa	e2eview1795010225370@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 13:57:07.734
a36dd940-bf5c-4dbe-a6b2-c5c03fb479b9	e2eview1795010225370@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 13:57:08.388
793fbb56-cb57-4e59-8a7f-faf78dd05b9a	e2eout1795010225370@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 13:57:08.853
64711c05-9af8-44ee-aba3-7a8b100c13ef	e2eout1795010225370@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 13:57:09.573
38726ed3-11c0-4483-8f4a-af8da0a193ed	e2emgr1795010225370@example.com	You were added to PX225370 · Phoenix Portal 1795010225370	project-member-added	SENT	\N	2026-11-18 13:57:10.026
0a36dab8-8f50-45db-a58f-a41cd0dcfe11	e2eemp1795010225370@example.com	You were added to PX225370 · Phoenix Portal 1795010225370	project-member-added	SENT	\N	2026-11-18 13:57:10.048
c1f3b32d-dde0-4e0d-9c2f-ad7c8712738c	e2eemp1795010225370@example.com	[PX225370-2] assigned to you: SSO callback	work-item-assigned	SENT	\N	2026-11-18 13:57:10.215
efed4287-c56f-4c06-92c9-fb02e66b81cd	e2emgr1795010225370@example.com	[PX225370-2] emp user moved it to Done	state-changed	SENT	\N	2026-11-18 13:57:11.499
81981eb4-8e45-4eb3-b8e5-2e97d27d15e3	e2emgr1795010238850@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 13:57:19.818
1ec8331a-d789-4ff4-9a8c-ee2382e7d337	e2emgr1795010238850@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 13:57:20.494
d66562c8-3755-4891-a103-3b6539ab25e7	e2eemp1795010238850@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 13:57:20.95
20a52a71-88c9-4493-adae-c55dbfb7ea6a	e2eemp1795010238850@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 13:57:22.092
63a369ef-224a-42d7-b193-7e6822debd10	e2eview1795010238850@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 13:57:22.158
d31e3e6e-ca2a-441b-b96c-843865582c19	e2eview1795010238850@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 13:57:22.58
da404976-68de-4590-b101-ae87b75f455a	e2eout1795010238850@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 13:57:23.034
23973d64-063f-4973-adc1-cd9485bd316e	e2eout1795010238850@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 13:57:24.138
4adec33b-efc6-4d3b-a1d7-0b3326d450ff	e2emgr1795010238850@example.com	You were added to E3238850 · E2E Phase3 1795010238850	project-member-added	SENT	\N	2026-11-18 13:57:24.22
bc93cbc8-58ad-40d2-8ac0-7a98caacce56	e2eemp1795010238850@example.com	You were added to E3238850 · E2E Phase3 1795010238850	project-member-added	SENT	\N	2026-11-18 13:57:24.247
2ca7b20d-98ad-4e52-9a8c-c81743192b7c	e2eview1795010238850@example.com	You were added to E3238850 · E2E Phase3 1795010238850	project-member-added	SENT	\N	2026-11-18 13:57:24.275
6e3787af-76b9-4ee3-8b20-784249591089	e2eemp1795010238850@example.com	[E3238850-3] assigned to you: As a user I can reset my password	work-item-assigned	SENT	\N	2026-11-18 13:57:24.597
fb077ff1-63b5-4e11-ad06-641d097ba4c2	e2emgr1795010238850@example.com	emp user mentioned you on E3238850-5	mentioned	SENT	\N	2026-11-18 13:57:25.058
2e129e0a-1208-40f6-b32f-8dfc232cb0bc	mgr1795010247451@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 13:57:27.469
b90d31e4-e5e9-4b92-a51c-fdcc40f8877f	mgr1795010247451@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 13:57:28.309
4c90ea08-e283-410a-ba3a-6ae937bcefc5	emp1795010248394@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 13:57:28.409
330b0428-32fa-4dfa-95ef-49c510a47867	emp1795010248394@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 13:57:28.839
18000613-b4f6-4982-8276-6a5bbd371ec5	emp1795010248394@example.com	You were added to CPR · Customer Portal Revamp	project-member-added	SENT	\N	2026-11-18 13:57:29.414
c322cf2f-1a0c-43fa-b149-ab219b5c2959	emp1795010258153@example.com	Verify your email for Project Tracker	verify-email	SENT	\N	2026-11-18 13:57:40.321
c6e72b8b-42d2-40f6-a4f2-7d7460428ecc	emp1795010258153@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 13:57:41.204
7e386b69-3f56-4544-b57e-48e91a4dd9af	emp1795010258153@example.com	Your Project Tracker role was updated	role-changed	SENT	\N	2026-11-18 13:57:46.571
131dc95d-bec2-4da1-ad61-b84a6f7f78cb	inv1795010258153@example.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 13:57:47.223
7d0491b1-cf5e-497d-9a2f-5db686012772	inv1795010258153@example.com	Welcome to Project Tracker	welcome	SENT	\N	2026-11-18 13:57:47.958
ab6eb411-48b6-470f-a383-dbec7d96eb2e	inv1795010258153@example.com	Reset your Project Tracker password	password-reset	SENT	\N	2026-11-18 13:57:48.505
9cda81c2-6f07-42a3-838d-39eaf1a4cd42	inv1795010258153@example.com	Your Project Tracker password was changed	password-changed	SENT	\N	2026-11-18 13:57:49.029
0231701f-21ae-42da-9d4d-642423007b50	inv1795010258153@example.com	Your Project Tracker account was deactivated	account-deactivated	SENT	\N	2026-11-18 13:57:49.589
6df294e1-91be-44c2-86dc-7c23d905c4bf	pravin@gmail.com	System Admin invited you to Project Tracker	invite	SENT	\N	2026-11-18 15:35:09.205
a2d6d507-a379-4e81-aeef-241af066ce6d	pravin@gmail.com	Your Project Tracker role was updated	role-changed	SENT	\N	2026-11-18 15:35:16.859
\.


--
-- Data for Name: environments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.environments (id, project_id, type, display_name, url, status, deployed_at, notes, created_at, updated_at) FROM stdin;
5e31c91b-0aa0-4427-abec-91bb4f65e95a	a2d8951f-9009-42e4-bb6c-3556eb0251fe	PROD	\N	https://aiemailsupport.jagoindia.in/	DEPLOYED	\N	\N	2026-11-18 08:14:31.222	2026-11-18 08:14:31.222
71e2a238-5dae-42e8-96d9-f02eeb74b522	02c028b2-1359-4ee6-a912-3c8b4236b96a	PROD	\N	https://jobagent.jagoindia.in/	DEPLOYED	\N	\N	2026-11-18 08:14:31.246	2026-11-18 08:14:31.246
d46ea70d-e82d-4c16-a313-15ea7a93e798	1cb56f39-85b6-4a81-a568-c37eafccfc95	PROD	\N	https://jagoindia.in/login	DEPLOYED	\N	\N	2026-11-18 08:14:31.252	2026-11-18 08:14:31.252
6b10439c-835b-4bde-9177-41832089e917	a0de1d26-a4d0-4619-9817-037fae989f39	DEV	\N	\N	DEPLOYED	\N	\N	2026-11-18 08:14:31.257	2026-11-18 08:14:31.257
308ba751-c7d6-4df5-b736-65eeb5add427	6c2b5463-43d1-4540-9aae-d14fcb769ab5	PROD	\N	https://hms.nirmaan.org/dashboard	DEPLOYED	\N	\N	2026-11-18 08:14:31.268	2026-11-18 08:14:31.268
74251972-99ba-49e6-ab45-ed317f1bd520	14898e97-dc8b-489e-a4e1-dc5964f5f7a3	PROD	\N	\N	LIVE	\N	\N	2026-11-18 08:14:31.272	2026-11-18 08:14:31.272
2b75af80-0ffe-4e51-ae8d-de8df71e04e3	393eb8f5-485d-4e3c-a61b-18aa242bf719	PROD	\N	https://187.127.166.46:8006/	DEPLOYED	\N	\N	2026-11-18 08:14:31.275	2026-11-18 08:14:31.275
\.


--
-- Data for Name: iteration_capacity; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.iteration_capacity (iteration_id, user_id, hours_per_day, days_off) FROM stdin;
\.


--
-- Data for Name: iteration_snapshots; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.iteration_snapshots (iteration_id, date, remaining_work, remaining_points, total_points, open_items) FROM stdin;
\.


--
-- Data for Name: iterations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.iterations (id, project_id, name, goal, start_date, end_date, state, started_at, completed_at, created_at, updated_at, baseline_points, baseline_work) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, type, title, body, link, actor_id, project_id, work_item_id, read_at, emailed_at, created_at) FROM stdin;
\.


--
-- Data for Name: project_members; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_members (project_id, user_id, role, added_at) FROM stdin;
a2d8951f-9009-42e4-bb6c-3556eb0251fe	28052739-2db0-422e-bb9e-07f3831f3121	MANAGER	2026-11-18 08:14:31.222
02c028b2-1359-4ee6-a912-3c8b4236b96a	28052739-2db0-422e-bb9e-07f3831f3121	MANAGER	2026-11-18 08:14:31.246
1cb56f39-85b6-4a81-a568-c37eafccfc95	28052739-2db0-422e-bb9e-07f3831f3121	MANAGER	2026-11-18 08:14:31.252
a0de1d26-a4d0-4619-9817-037fae989f39	28052739-2db0-422e-bb9e-07f3831f3121	MANAGER	2026-11-18 08:14:31.257
7b2e79e1-d2ca-4b04-89e9-172f86866758	28052739-2db0-422e-bb9e-07f3831f3121	MANAGER	2026-11-18 08:14:31.263
6c2b5463-43d1-4540-9aae-d14fcb769ab5	28052739-2db0-422e-bb9e-07f3831f3121	MANAGER	2026-11-18 08:14:31.268
14898e97-dc8b-489e-a4e1-dc5964f5f7a3	28052739-2db0-422e-bb9e-07f3831f3121	MANAGER	2026-11-18 08:14:31.272
393eb8f5-485d-4e3c-a61b-18aa242bf719	28052739-2db0-422e-bb9e-07f3831f3121	MANAGER	2026-11-18 08:14:31.275
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.projects (id, key, name, description, category_id, priority, status, dev_status, start_date, target_date, owner_id, created_by_id, work_item_seq, archived_at, created_at, updated_at, board_settings) FROM stdin;
a2d8951f-9009-42e4-bb6c-3556eb0251fe	AEA	AI Email Assitant	Using AI tool to analysis Emails and suggest reply emails, categories, sentiment type, and prioritiy wise disply. Using Dashboard to monitor activitiy	c059bc3b-228c-4a77-ad03-3964e323321f	HIGH	ACTIVE	IN_PROGRESS	2026-06-14	2026-10-05	28052739-2db0-422e-bb9e-07f3831f3121	28052739-2db0-422e-bb9e-07f3831f3121	0	\N	2026-11-18 08:14:31.222	2026-11-18 08:14:31.222	{}
02c028b2-1359-4ee6-a912-3c8b4236b96a	JAA	Job Agent AI	With AI tool analysis user profile and suggest job roles to apply, create cover letter, ATS score	c059bc3b-228c-4a77-ad03-3964e323321f	MEDIUM	ACTIVE	IN_PROGRESS	2026-05-31	2026-10-23	28052739-2db0-422e-bb9e-07f3831f3121	28052739-2db0-422e-bb9e-07f3831f3121	0	\N	2026-11-18 08:14:31.246	2026-11-18 08:14:31.246	{}
1cb56f39-85b6-4a81-a568-c37eafccfc95	BCM	BCM App	Organizations must plan for disruptions, assess risks and reach staff quickly in a crisis.	c2c5b6a1-a4c3-4753-9988-fd7a3229cf51	HIGH	COMPLETED	COMPLETED	2029-09-13	2026-09-29	28052739-2db0-422e-bb9e-07f3831f3121	28052739-2db0-422e-bb9e-07f3831f3121	0	\N	2026-11-18 08:14:31.252	2026-11-18 08:14:31.252	{}
a0de1d26-a4d0-4619-9817-037fae989f39	TP	Tree Plantation	\N	c2c5b6a1-a4c3-4753-9988-fd7a3229cf51	LOW	COMPLETED	COMPLETED	2026-04-22	2026-05-30	28052739-2db0-422e-bb9e-07f3831f3121	28052739-2db0-422e-bb9e-07f3831f3121	0	\N	2026-11-18 08:14:31.257	2026-11-18 08:14:31.257	{}
7b2e79e1-d2ca-4b04-89e9-172f86866758	LA	Letscalm app	Mobile app -record voice, based on sentiment analysis play a song to be calm	3bc11efc-0820-4fc2-9342-6316728c09cb	MEDIUM	CLIENT_NO_RESPONSE	COMPLETED	2024-11-24	2026-01-17	28052739-2db0-422e-bb9e-07f3831f3121	28052739-2db0-422e-bb9e-07f3831f3121	0	\N	2026-11-18 08:14:31.263	2026-11-18 08:14:31.263	{}
6c2b5463-43d1-4540-9aae-d14fcb769ab5	HMS	HMS	Health care management system to handle medical camp process	383c4119-634d-4331-be4b-c2fb9437388c	LOW	COMPLETED	COMPLETED	2024-09-09	2026-03-18	28052739-2db0-422e-bb9e-07f3831f3121	28052739-2db0-422e-bb9e-07f3831f3121	0	\N	2026-11-18 08:14:31.268	2026-11-18 08:14:31.268	{}
14898e97-dc8b-489e-a4e1-dc5964f5f7a3	BODH	Bodhika	An online educational platform where students can learn concepts, practice questions, write exams, and track their performance.	383c4119-634d-4331-be4b-c2fb9437388c	HIGH	COMPLETED	COMPLETED	\N	\N	28052739-2db0-422e-bb9e-07f3831f3121	28052739-2db0-422e-bb9e-07f3831f3121	0	\N	2026-11-18 08:14:31.272	2026-11-18 08:14:31.272	{}
393eb8f5-485d-4e3c-a61b-18aa242bf719	EISAR	Enterprise-IT-Support-Agentic-RAG	An AI-powered Enterprise IT Support Agent using LangGraph and RAG to answer technical queries from internal knowledge bases, retrieve relevant documentation, and provide evidence-based troubleshooting guidance.	c059bc3b-228c-4a77-ad03-3964e323321f	HIGH	ACTIVE	IN_PROGRESS	2026-10-18	2026-10-24	28052739-2db0-422e-bb9e-07f3831f3121	28052739-2db0-422e-bb9e-07f3831f3121	0	\N	2026-11-18 08:14:31.275	2026-11-18 08:14:31.275	{}
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.refresh_tokens (id, user_id, token_hash, family_id, expires_at, revoked_at, user_agent, ip, created_at) FROM stdin;
31ec7906-f7e3-43b2-9794-fdc0802b19b1	28052739-2db0-422e-bb9e-07f3831f3121	a9fb56265e1d7fa5e4aa0e72d73975a99df45ab4019a7e65f80fc6c50e7e7050	71487d2a-bebb-4152-98c8-9bf8cfdecd25	2026-11-25 08:02:49.875	\N	node	::1	2026-11-18 08:02:49.885
79642a1d-b78d-4ff3-9d27-64173d20cb48	28052739-2db0-422e-bb9e-07f3831f3121	ab003ca81cf34bc552ae9fd0e9a385bdbde9f321814961e60d89fc7535369af3	6001bbb7-2071-42fa-b1fa-3cfbee229d00	2026-11-25 08:02:50.981	2026-11-18 08:02:51.005	node	::1	2026-11-18 08:02:50.982
14ad0bd4-7e95-4c01-880b-3034e7e443ea	28052739-2db0-422e-bb9e-07f3831f3121	703d1954de9005c86d4872c388bb748753456c1a09246d5ed1fb5595df02126e	0830b6e5-c804-463d-96e5-9caa96881762	2026-11-25 15:30:37.783	2026-11-18 15:30:50.913	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0	::1	2026-11-18 15:30:37.789
ceb8aa52-c774-4122-ae77-9c29f42f0e4c	28052739-2db0-422e-bb9e-07f3831f3121	1abc280495142b6f5efc3993c71e3547df8e685256742d21a95e73ff2f580148	0830b6e5-c804-463d-96e5-9caa96881762	2026-11-25 15:33:15.542	\N	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	::1	2026-11-18 15:33:15.542
d30ad34b-fcc5-4812-930a-83b536fe59ff	28052739-2db0-422e-bb9e-07f3831f3121	26baf3dd430449974991c6a410ed72de29553ab16e24720bb15239ba6851b021	6001bbb7-2071-42fa-b1fa-3cfbee229d00	2026-11-25 08:02:51.012	2026-11-18 08:03:00.423	node	::1	2026-11-18 08:02:51.013
2ddde989-0d7e-4564-af37-1592a331f9e8	28052739-2db0-422e-bb9e-07f3831f3121	f2fe5964544daa691e74248b8acb4d16b471b95632c1103aa6a8d88729ab11ef	2d9a5bf4-7a34-4c71-a592-902c10f9cb62	2026-11-25 08:14:30.902	\N	node	::1	2026-11-18 08:14:30.91
b6c07234-442c-4e67-ad3f-71edbb09e5cb	28052739-2db0-422e-bb9e-07f3831f3121	5607164490f0b807dc87999855c37a40b4bf4ba3044358106a60b77de780b0ea	b0bea67f-8232-458a-aad1-fcd56ed5407a	2026-11-25 08:21:39.119	\N	node	::1	2026-11-18 08:21:39.128
4313bfd3-593b-4d1b-b984-28d4dae7303d	28052739-2db0-422e-bb9e-07f3831f3121	89e4d0e8bf3e2f3dc9a04d5056eb1b9d0b4bac7d1e3e80e897c08adbd9d1a4aa	8a94b2f8-08ae-4a39-b132-085da6bc8100	2026-11-25 08:21:40.217	2026-11-18 08:21:40.245	node	::1	2026-11-18 08:21:40.217
8bc7515c-ed5c-49ec-92ac-d110c47e5655	28052739-2db0-422e-bb9e-07f3831f3121	e8c1c28073dd0195a5afb5d2be1c48f942b6c5631bc37d24e0e6355004c6b02d	8a94b2f8-08ae-4a39-b132-085da6bc8100	2026-11-25 08:21:40.252	2026-11-18 08:21:49.909	node	::1	2026-11-18 08:21:40.252
f00006db-fb89-4815-aeab-95c0a5aa8663	28052739-2db0-422e-bb9e-07f3831f3121	c6fc658319c5d2e45b20e6290b5ea1840b9b970f5af992e8c51247f62411c85b	89e6b06a-54a3-40e1-8327-a243f718143c	2026-11-25 08:21:50.669	\N	node	::1	2026-11-18 08:21:50.669
576b63a4-702e-4bd9-912f-e39f5d3728ec	28052739-2db0-422e-bb9e-07f3831f3121	b517a62049af6220683ab095198d3e9b32c90e79c7dd7215ae15ca329df128a1	aea52339-ef17-4aed-9839-4810454d0542	2026-11-25 08:22:30.706	\N	node	::1	2026-11-18 08:22:30.715
ebaaa4b6-5957-4204-99b5-26a325409280	28052739-2db0-422e-bb9e-07f3831f3121	68570c27fef9541dfe547d30c1f60462820dffc6efe1979885f893c714dcb642	e883eebf-cb85-4c01-973a-82788e5788ca	2026-11-25 08:22:31.876	2026-11-18 08:22:31.901	node	::1	2026-11-18 08:22:31.877
fb2c6a58-fa3e-4ee3-926b-93bac2e63b0f	28052739-2db0-422e-bb9e-07f3831f3121	0d81bf29ec203df6d21fe51a7f5db025d3ea1920f8ade8648ac25b144c3c9356	e883eebf-cb85-4c01-973a-82788e5788ca	2026-11-25 08:22:31.907	2026-11-18 08:22:41.723	node	::1	2026-11-18 08:22:31.908
b90ee6e2-95f9-4f1a-8c23-94d7bafe3732	28052739-2db0-422e-bb9e-07f3831f3121	65c118388bd89f2c29825983c1f101cd9c3dd5adecd08911d0787e3ee6bff903	58352d99-8c62-46f3-a0fa-97ed626bb87b	2026-11-25 08:26:30.973	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0	::1	2026-11-18 08:26:30.982
de19b101-0756-4830-ae7b-1b529b3dbb62	28052739-2db0-422e-bb9e-07f3831f3121	cb14065681a17d492490720f5801c23ad947137e1d4d40fad03806eddf1f6e30	0205b46c-2b26-476c-9429-1ce0aa14cb1a	2026-11-25 08:35:43.692	\N	node	::1	2026-11-18 08:35:43.701
b4f473b5-3c73-4d49-b0bd-3ed283e7d359	28052739-2db0-422e-bb9e-07f3831f3121	9482a8692bc64d18fda883dd248ea435865ca5af14625aa4b5ab7d9ddc881e75	4555e385-93d2-498e-b9fd-be901e41fe00	2026-11-25 08:52:52.935	\N	node	::1	2026-11-18 08:52:52.96
a03d8621-35ac-46b9-b19f-91b2d8887800	28052739-2db0-422e-bb9e-07f3831f3121	84dd38f1c4bc645e808bd5ac5cec9cf5edfed292c7cca77db63a707c90da77ff	0830b6e5-c804-463d-96e5-9caa96881762	2026-11-25 15:30:50.985	2026-11-18 15:31:30.23	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0	::1	2026-11-18 15:30:50.986
a85c2f7e-efc4-442c-9ef3-11a76a2c217d	28052739-2db0-422e-bb9e-07f3831f3121	2c4912ae4a923f1549a6e6db0cdb0eb885c77908a0d566e73e5515ddce8a2711	e2bfe4e4-c5b3-4981-b813-32b881eef426	2026-11-25 08:53:01.257	\N	node	::1	2026-11-18 08:53:01.257
54c7021d-6941-42e6-b5e4-680ff6171e9b	28052739-2db0-422e-bb9e-07f3831f3121	f080e782f51e0ade5832742e10d40f4546af4e541339ed4afca31a665920632f	19404e52-4d7f-4ce9-a9ce-6f57b8f42689	2026-11-25 08:53:19.43	\N	node	::1	2026-11-18 08:53:19.439
077b58ef-0ac5-4feb-8d91-0a0622bf03f9	28052739-2db0-422e-bb9e-07f3831f3121	a5705a39450486c86664b6ee85cf792ff2a84bd1f5262a4458dd67508549eb1f	a75c72b7-3340-483e-96d7-b51386f7ec4d	2026-11-25 08:53:20.55	2026-11-18 08:53:20.574	node	::1	2026-11-18 08:53:20.551
920c77d4-76a7-4b8c-a9af-ae7bef40ccf7	28052739-2db0-422e-bb9e-07f3831f3121	134b0e857acf388889c2824c50fd483f027778d11ad59aa53cd3c5b2dd64d43a	1a6442d2-6ce2-46bf-a01e-cd0b07870014	2026-11-25 12:13:04.922	\N	node	::1	2026-11-18 12:13:04.922
bf6fff46-7770-429c-b9ef-04d1e6edd615	28052739-2db0-422e-bb9e-07f3831f3121	b384c758c2d1dad2d0f88998e3e7d2c4a8d756b679038e128b7f3ff305adf12a	a75c72b7-3340-483e-96d7-b51386f7ec4d	2026-11-25 08:53:20.58	2026-11-18 08:53:29.943	node	::1	2026-11-18 08:53:20.58
29a1398a-39a4-4628-bd9c-761e80985b78	28052739-2db0-422e-bb9e-07f3831f3121	5bfa8a9a27ae7a75a08b283078c9ee2d7796a84b767782e5a3567801d5fd9358	bb538746-d71e-4d77-9f9d-9a9dd4b6a2d1	2026-11-25 12:01:59.811	\N	node	::1	2026-11-18 12:01:59.82
5fb3d9cd-eb6a-411e-a5ba-b8b4ec3dbd04	28052739-2db0-422e-bb9e-07f3831f3121	8c6e97835348d7941d3b07b04b1dc46254ae4c0ab740950df141696430817dd5	762269ac-5382-4925-b222-4670cc6df047	2026-11-25 12:03:21.003	\N	node	::1	2026-11-18 12:03:21.011
de9b6179-76e6-42cc-9654-d88bebba71c3	28052739-2db0-422e-bb9e-07f3831f3121	d25c187077dd937e0423fd956e1289339d3b2d9e9cb075eac5fee5c2cd8f1eea	e51e0f07-a0f7-4a85-82ed-ec863787c7a8	2026-11-25 12:12:35.18	\N	node	::1	2026-11-18 12:12:35.188
a5266ed2-0786-4cf0-9aca-337331417aaa	28052739-2db0-422e-bb9e-07f3831f3121	f14f74e97a27562c7e170b39c85aa0d903928787329192650dc439d52c9b5b9f	fb78431b-f3cb-4361-8e3e-89e8262a3195	2026-11-25 12:12:42.832	\N	node	::1	2026-11-18 12:12:42.833
c6724094-5797-46a4-b5f1-db629b864322	28052739-2db0-422e-bb9e-07f3831f3121	cdb403e002aac07ac18acf0835ef44127ce8288511fb098748719fdc8bda3682	a2f4b9bd-a67b-4fe8-8b83-3e81d9ed3404	2026-11-25 12:13:00.573	\N	node	::1	2026-11-18 12:13:00.582
d9187344-4262-45bb-8adb-f39d98e664b0	28052739-2db0-422e-bb9e-07f3831f3121	1f82fc6faa50afc6a211b27fcd72a65628a48aac7ca0c0054058228fe8198ef3	b2aa5fe3-8536-4385-b401-3051d00ee1fe	2026-11-25 12:13:05.949	2026-11-18 12:13:05.965	node	::1	2026-11-18 12:13:05.95
cd8f49ee-e754-4c7f-828a-d0d4044290c6	28052739-2db0-422e-bb9e-07f3831f3121	c36c795e0ccd267fa3b71e4d70d7986ff42f27797481f004967b3ef1a423ddd0	b2aa5fe3-8536-4385-b401-3051d00ee1fe	2026-11-25 12:13:05.971	2026-11-18 12:13:15.253	node	::1	2026-11-18 12:13:05.972
0b6bdbe7-9aa8-4b68-b2f8-e7bc5483c3fd	28052739-2db0-422e-bb9e-07f3831f3121	89f9caa0500844b11649b1eee73fdf23de3acfd26bf4fe193bdd5d9d759b041d	5b836c0a-ced9-4c52-ab65-6f6febf026c3	2026-11-25 13:46:40.669	\N	node	::1	2026-11-18 13:46:40.676
b47fdd90-2c5e-4f54-8813-01ba248c3127	28052739-2db0-422e-bb9e-07f3831f3121	b4c1fb1c41747a49f51f0636e6f70aa5016207e9c0c02cea2c101d6c6361ae8e	a1992d10-15de-46c6-b0ac-8e4e4f5d9c73	2026-11-25 13:47:50.404	\N	node	::1	2026-11-18 13:47:50.413
67eff5ba-b4b7-43b1-ab91-ee6b3c598905	28052739-2db0-422e-bb9e-07f3831f3121	e1e2cc269d46449bf6b170fc745c21da5d7e0a33aaf4d4285dd9ceaa17cf60a9	5a090c2c-12d9-494e-8695-85f9e32aaea9	2026-11-25 13:56:45.061	\N	node	::1	2026-11-18 13:56:45.07
4dc2e876-9366-4eb1-bb3d-e7e2c41e1aac	28052739-2db0-422e-bb9e-07f3831f3121	20735729ca7e20668a32a74d84029615a92868f9557429bd174855e0afb48143	d8cd6984-ead3-467d-b308-92fa5bbf5008	2026-11-25 13:57:05.83	\N	node	::1	2026-11-18 13:57:05.831
d3dd7087-78c9-4715-89cb-15ca1f8c6790	28052739-2db0-422e-bb9e-07f3831f3121	43d3bf916369219571ddef54dfaa0fdd54c70470a37d34c6de6d5124d151998a	7c680768-9be9-42c8-a8bc-4d1403145b7f	2026-11-25 13:57:19.581	\N	node	::1	2026-11-18 13:57:19.59
7c076b63-1461-4706-8a65-c9015cd1178d	28052739-2db0-422e-bb9e-07f3831f3121	0dfe3abbb8340c6ed41564501386a3e62c6d95031985607214c624365f640270	88323e49-7696-4a4f-ada2-a6b63980df43	2026-11-25 13:57:27.126	\N	node	::1	2026-11-18 13:57:27.126
00c34318-9f9c-42d2-bdac-7c516b720156	28052739-2db0-422e-bb9e-07f3831f3121	5b197b517b29b848581949741f5ddb4dad75d89199bbbc347b3c5546a60dfedf	8452a96b-993f-46ac-bdc2-e2d2bb843965	2026-11-25 13:57:38.763	\N	node	::1	2026-11-18 13:57:38.771
96cca78f-951a-4ea3-a694-b6d4df1ce1cd	28052739-2db0-422e-bb9e-07f3831f3121	431e653398f837fde73c55fdb1428758d0eb64d3901fab23b8cabbebe6457de6	9de8257b-6b3c-45e5-a536-2ed6c025cf4e	2026-11-25 13:57:39.766	2026-11-18 13:57:39.806	node	::1	2026-11-18 13:57:39.767
5aaf3dbe-2626-4b69-8d94-48d659921991	28052739-2db0-422e-bb9e-07f3831f3121	4e0c309ccf8928e31b37ef5039b2dbc74a692a7d453f29e9dbb2c3853e843f3a	9de8257b-6b3c-45e5-a536-2ed6c025cf4e	2026-11-25 13:57:39.815	2026-11-18 13:57:49.598	node	::1	2026-11-18 13:57:39.815
615ce7c4-a591-4d64-b195-fc734931abf1	28052739-2db0-422e-bb9e-07f3831f3121	110d165ccef7c9821e7fa17c1afdd2fdccb2f6fe1934c3dbfa9591c7922e2a53	0830b6e5-c804-463d-96e5-9caa96881762	2026-11-25 15:31:30.233	2026-11-18 15:33:15.468	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	::1	2026-11-18 15:31:30.234
\.


--
-- Data for Name: saved_queries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.saved_queries (id, owner_id, name, filters, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, name, email, password_hash, google_id, avatar_url, role, is_active, email_verified_at, last_login_at, created_at, updated_at, notification_prefs) FROM stdin;
28052739-2db0-422e-bb9e-07f3831f3121	System Admin	admin@example.com	$2b$12$/Y9pu5BI30aEExhibIlPD.OgFH9I1aOA5hl52vZy3hqgKdH.P9Y3y	\N	\N	ADMIN	t	2026-11-18 08:02:08.93	2026-11-18 15:30:37.724	2026-11-18 08:02:08.945	2026-11-18 15:30:37.732	{}
24de9de0-731c-44a9-b155-675a0f5adfcf	Pravin	pravin@gmail.com	\N	\N	\N	ADMIN	t	\N	\N	2026-11-18 15:35:09.079	2026-11-18 15:35:16.851	{}
\.


--
-- Data for Name: work_item_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.work_item_history (id, work_item_id, actor_id, field, old_value, new_value, created_at) FROM stdin;
\.


--
-- Data for Name: work_item_links; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.work_item_links (id, source_id, target_id, type, created_by_id, created_at) FROM stdin;
\.


--
-- Data for Name: work_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.work_items (id, project_id, number, type, title, description, state, priority, severity, resolution, story_points, original_estimate, remaining_work, completed_work, start_date, due_date, tags, environment, repro_steps, expected_result, actual_result, assignee_id, created_by_id, parent_id, rank, state_changed_at, closed_at, created_at, updated_at, iteration_id, due_reminder_for, search_vector) FROM stdin;
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: attachments attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: auth_tokens auth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_tokens
    ADD CONSTRAINT auth_tokens_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: credentials credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_pkey PRIMARY KEY (id);


--
-- Name: email_logs email_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_pkey PRIMARY KEY (id);


--
-- Name: environments environments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.environments
    ADD CONSTRAINT environments_pkey PRIMARY KEY (id);


--
-- Name: iteration_capacity iteration_capacity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iteration_capacity
    ADD CONSTRAINT iteration_capacity_pkey PRIMARY KEY (iteration_id, user_id);


--
-- Name: iteration_snapshots iteration_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iteration_snapshots
    ADD CONSTRAINT iteration_snapshots_pkey PRIMARY KEY (iteration_id, date);


--
-- Name: iterations iterations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iterations
    ADD CONSTRAINT iterations_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: project_members project_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_pkey PRIMARY KEY (project_id, user_id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: saved_queries saved_queries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_queries
    ADD CONSTRAINT saved_queries_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: work_item_history work_item_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_item_history
    ADD CONSTRAINT work_item_history_pkey PRIMARY KEY (id);


--
-- Name: work_item_links work_item_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_item_links
    ADD CONSTRAINT work_item_links_pkey PRIMARY KEY (id);


--
-- Name: work_items work_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_items
    ADD CONSTRAINT work_items_pkey PRIMARY KEY (id);


--
-- Name: attachments_storage_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX attachments_storage_key_key ON public.attachments USING btree (storage_key);


--
-- Name: attachments_work_item_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attachments_work_item_id_idx ON public.attachments USING btree (work_item_id);


--
-- Name: audit_logs_actor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_actor_id_idx ON public.audit_logs USING btree (actor_id);


--
-- Name: audit_logs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_created_at_idx ON public.audit_logs USING btree (created_at);


--
-- Name: audit_logs_entity_entity_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_entity_entity_id_idx ON public.audit_logs USING btree (entity, entity_id);


--
-- Name: auth_tokens_token_hash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX auth_tokens_token_hash_key ON public.auth_tokens USING btree (token_hash);


--
-- Name: auth_tokens_user_id_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_tokens_user_id_type_idx ON public.auth_tokens USING btree (user_id, type);


--
-- Name: categories_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX categories_name_key ON public.categories USING btree (name);


--
-- Name: comments_work_item_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX comments_work_item_id_created_at_idx ON public.comments USING btree (work_item_id, created_at);


--
-- Name: credentials_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX credentials_project_id_idx ON public.credentials USING btree (project_id);


--
-- Name: email_logs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_logs_created_at_idx ON public.email_logs USING btree (created_at);


--
-- Name: email_logs_to_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_logs_to_idx ON public.email_logs USING btree ("to");


--
-- Name: environments_project_id_type_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX environments_project_id_type_key ON public.environments USING btree (project_id, type);


--
-- Name: iterations_project_id_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX iterations_project_id_state_idx ON public.iterations USING btree (project_id, state);


--
-- Name: notifications_user_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_id_created_at_idx ON public.notifications USING btree (user_id, created_at);


--
-- Name: notifications_user_id_read_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_id_read_at_idx ON public.notifications USING btree (user_id, read_at);


--
-- Name: project_members_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_members_user_id_idx ON public.project_members USING btree (user_id);


--
-- Name: projects_archived_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX projects_archived_at_idx ON public.projects USING btree (archived_at);


--
-- Name: projects_category_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX projects_category_id_idx ON public.projects USING btree (category_id);


--
-- Name: projects_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX projects_key_key ON public.projects USING btree (key);


--
-- Name: projects_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX projects_status_idx ON public.projects USING btree (status);


--
-- Name: refresh_tokens_family_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX refresh_tokens_family_id_idx ON public.refresh_tokens USING btree (family_id);


--
-- Name: refresh_tokens_token_hash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX refresh_tokens_token_hash_key ON public.refresh_tokens USING btree (token_hash);


--
-- Name: refresh_tokens_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX refresh_tokens_user_id_idx ON public.refresh_tokens USING btree (user_id);


--
-- Name: saved_queries_owner_id_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX saved_queries_owner_id_name_key ON public.saved_queries USING btree (owner_id, name);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_google_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_google_id_key ON public.users USING btree (google_id);


--
-- Name: users_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_role_idx ON public.users USING btree (role);


--
-- Name: work_item_history_work_item_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_item_history_work_item_id_created_at_idx ON public.work_item_history USING btree (work_item_id, created_at);


--
-- Name: work_item_links_source_id_target_id_type_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX work_item_links_source_id_target_id_type_key ON public.work_item_links USING btree (source_id, target_id, type);


--
-- Name: work_item_links_target_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_item_links_target_id_idx ON public.work_item_links USING btree (target_id);


--
-- Name: work_items_assignee_id_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_items_assignee_id_state_idx ON public.work_items USING btree (assignee_id, state);


--
-- Name: work_items_iteration_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_items_iteration_id_idx ON public.work_items USING btree (iteration_id);


--
-- Name: work_items_parent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_items_parent_id_idx ON public.work_items USING btree (parent_id);


--
-- Name: work_items_project_id_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX work_items_project_id_number_key ON public.work_items USING btree (project_id, number);


--
-- Name: work_items_project_id_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_items_project_id_state_idx ON public.work_items USING btree (project_id, state);


--
-- Name: work_items_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_items_search_idx ON public.work_items USING gin (search_vector);


--
-- Name: work_items_tags_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_items_tags_idx ON public.work_items USING gin (tags);


--
-- Name: work_items_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_items_type_idx ON public.work_items USING btree (type);


--
-- Name: work_items work_items_search_vector_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER work_items_search_vector_trg BEFORE INSERT OR UPDATE OF title, description ON public.work_items FOR EACH ROW EXECUTE FUNCTION public.work_items_search_vector_update();


--
-- Name: attachments attachments_uploaded_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_uploaded_by_id_fkey FOREIGN KEY (uploaded_by_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: attachments attachments_work_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_work_item_id_fkey FOREIGN KEY (work_item_id) REFERENCES public.work_items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: auth_tokens auth_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_tokens
    ADD CONSTRAINT auth_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: comments comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: comments comments_work_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_work_item_id_fkey FOREIGN KEY (work_item_id) REFERENCES public.work_items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: credentials credentials_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: credentials credentials_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: credentials credentials_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: environments environments_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.environments
    ADD CONSTRAINT environments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: iteration_capacity iteration_capacity_iteration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iteration_capacity
    ADD CONSTRAINT iteration_capacity_iteration_id_fkey FOREIGN KEY (iteration_id) REFERENCES public.iterations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: iteration_capacity iteration_capacity_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iteration_capacity
    ADD CONSTRAINT iteration_capacity_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: iteration_snapshots iteration_snapshots_iteration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iteration_snapshots
    ADD CONSTRAINT iteration_snapshots_iteration_id_fkey FOREIGN KEY (iteration_id) REFERENCES public.iterations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: iterations iterations_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iterations
    ADD CONSTRAINT iterations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notifications notifications_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: project_members project_members_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: project_members project_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: projects projects_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: projects projects_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: projects projects_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: saved_queries saved_queries_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_queries
    ADD CONSTRAINT saved_queries_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: work_item_history work_item_history_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_item_history
    ADD CONSTRAINT work_item_history_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: work_item_history work_item_history_work_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_item_history
    ADD CONSTRAINT work_item_history_work_item_id_fkey FOREIGN KEY (work_item_id) REFERENCES public.work_items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: work_item_links work_item_links_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_item_links
    ADD CONSTRAINT work_item_links_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: work_item_links work_item_links_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_item_links
    ADD CONSTRAINT work_item_links_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.work_items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: work_item_links work_item_links_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_item_links
    ADD CONSTRAINT work_item_links_target_id_fkey FOREIGN KEY (target_id) REFERENCES public.work_items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: work_items work_items_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_items
    ADD CONSTRAINT work_items_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: work_items work_items_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_items
    ADD CONSTRAINT work_items_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: work_items work_items_iteration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_items
    ADD CONSTRAINT work_items_iteration_id_fkey FOREIGN KEY (iteration_id) REFERENCES public.iterations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: work_items work_items_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_items
    ADD CONSTRAINT work_items_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.work_items(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: work_items work_items_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_items
    ADD CONSTRAINT work_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

