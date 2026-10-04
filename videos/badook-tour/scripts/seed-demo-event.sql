-- The tour's demo event becomes the site's sample: נועה & איתי, 17.06.2027, with lived-in data.
\set I '''c68c616a-f8b5-4d88-910b-a6aae1a986e1'''
begin;
-- the invitation: the site's video sample, its own address
update invitations i set
  draft = jsonb_set(s.draft, '{share,slug}', '"noa-ve-itay"'),
  published = jsonb_set(coalesce(s.published, s.draft), '{share,slug}', '"noa-ve-itay"'),
  slug = 'noa-ve-itay', template_id = s.template_id, event_type = s.event_type, updated_at = now()
from invitations s where s.slug = 'noa-and-itay-video' and i.id = :I;
update auth.users set email = 'noa.itay@example.com' where id = 'd3e17f6d-0f48-4c1a-b50c-489ab7d92e79';
update accounts set full_name = 'נועה לוי' where user_id = 'd3e17f6d-0f48-4c1a-b50c-489ab7d92e79';

-- planning: the new date; what is already behind them is done
update plan_settings set anchor_date = '2027-06-17', manual_adults = 220, manual_children = 20 where invitation_id = :I;
update plan_tasks set due_date = date '2027-06-17' + offset_days where invitation_id = :I and not due_is_manual;
update plan_tasks set status = 'done', completed_at = now() - interval '3 days'
 where invitation_id = :I and system_key is null and offset_days <= -380;
update plan_tasks set status = 'doing' where invitation_id = :I and tpl_key in ('choose_catering','check_kashrut');

-- guests: real names, groups and sizes; most invitations already went out on WhatsApp
with names(n, name, grp, size) as (values
 (1,'משפחת לוי — הורי הכלה','משפחת הכלה',2),(2,'סבתא שושנה לוי','משפחת הכלה',1),(3,'יעל ועומר לוי','משפחת הכלה',2),
 (4,'משפחת גבאי','משפחת הכלה',4),(5,'דודה מיכל ודוד רפי','משפחת הכלה',2),(6,'משפחת אוחיון','משפחת הכלה',5),
 (7,'משפחת כהן — הורי החתן','משפחת החתן',2),(8,'סבא יוסף כהן','משפחת החתן',1),(9,'נועם ושירה כהן','משפחת החתן',2),
 (10,'משפחת ברק','משפחת החתן',4),(11,'דודה אורית','משפחת החתן',2),(12,'משפחת שטרן','משפחת החתן',4),
 (13,'תמר אברהם','חברות של נועה',2),(14,'מאיה רוזן','חברות של נועה',2),(15,'הדר ואלון','חברות של נועה',2),
 (16,'ליאת פרץ','חברות של נועה',1),(17,'רוני וגיל','חברות של נועה',2),(18,'שני מזרחי','חברות של נועה',2),
 (19,'עידו בן דוד','חברים של איתי',2),(20,'אסף ונטע','חברים של איתי',2),(21,'יונתן גולן','חברים של איתי',1),
 (22,'דניאל ועדי','חברים של איתי',2),(23,'אריאל שמש','חברים של איתי',2),(24,'רועי וקרן','חברים של איתי',2),
 (25,'הצוות של נועה','עבודה',6),(26,'אורי טל','עבודה',2),(27,'מיכאל ודנה','עבודה',2),(28,'הצוות של איתי','עבודה',5),
 (29,'גלית חדד','עבודה',1),(30,'בני ואתי','שכנים',2),(31,'משפחת דהן','שכנים',4),(32,'אלה ויובל','חברים מהצבא',2),
 (33,'ענבר כץ','חברים מהצבא',1),(34,'תום וליה','חברים מהצבא',2),(35,'משפחת עזרא','משפחת החתן',3),
 (36,'רחל ומשה ביטון','משפחת הכלה',2),(37,'אביב נחום','חברים של איתי',1),(38,'סתיו ואור','חברות של נועה',2),
 (39,'משפחת וקנין','שכנים',4),(40,'עדן שלום','עבודה',1)),
 g as (select id, row_number() over (order by seq) n from invitation_guests where invitation_id = :I)
update invitation_guests ig set name = names.name, group_name = names.grp, party_size = names.size,
  send_status = case when names.n <= 22 then 'read' when names.n <= 34 then 'delivered' else 'none' end,
  send_channel = case when names.n <= 34 then 'whatsapp' end,
  sent_at = case when names.n <= 34 then now() - interval '6 days' + (names.n || ' minutes')::interval end,
  opened_at = case when names.n <= 26 then now() - interval '5 days' + (names.n || ' hours')::interval end,
  last_opened_at = case when names.n <= 26 then now() - interval '1 days' + (names.n || ' minutes')::interval end,
  open_count = case when names.n <= 26 then 1 + names.n % 4 else 0 end
from g join names on names.n = g.n where ig.id = g.id;

-- replies: 21 coming, 5 not, one from the general link still to assign
delete from rsvp_responses where invitation_id = :I;
insert into rsvp_responses (invitation_id, attending, locale, primary_name, phone, adults_count, children_count, message, edit_token_hash, guest_id, created_at)
select :I, g.n not in (6, 12, 21, 29, 33), 'he', g.name, g.phone,
  case when g.n in (6, 12, 21, 29, 33) then 0 when g.n in (4,10,31) then 2 else g.party_size end,
  case when g.n in (4,10,31) then 2 else 0 end,
  case g.n when 2 then 'מתרגשת! לא אפספס את זה בשום אופן ❤️' when 14 then 'נהיה שם, מזל טוב!' when 19 then 'מגיעים לרקוד עד הבוקר' else null end,
  md5(g.id::text) || md5(g.name), g.id, now() - interval '5 days' + (g.n || ' hours')::interval
from (select ig.*, row_number() over (order by seq) n from invitation_guests ig where invitation_id = :I) g where g.n <= 26;
insert into rsvp_responses (invitation_id, attending, locale, primary_name, adults_count, children_count, message, edit_token_hash, created_at)
values (:I, true, 'he', 'משפחת אזולאי', 2, 1, 'תודה על ההזמנה!', md5('azulai') || md5('general'), now() - interval '7 hours');

-- vendors with quotes, and a few ideas
delete from plan_vendors where invitation_id = :I;
insert into plan_vendors (invitation_id, name, category_key, phone, status, quote_amount, rating, notes, sort) values
 (:I,'אחוזת הגפן','venue','04-6390000','booked',25500,5,'כולל גן לחופה',1),
 (:I,'קייטרינג שפע','catering','052-5551234','quote',24500,4,'טעימות ב־15.1',2),
 (:I,'דנה צילום','photographer','054-7778899','booked',5600,5,'צילום + מגנטים',3),
 (:I,'DJ שחר','dj','050-1112233','booked',5800,5,null,4),
 (:I,'פרחי השרון','flowers','053-4445566','contacted',null,null,'לבקש הצעה לזר + שולחנות',5),
 (:I,'סטודיו לאור','videographer','058-9990011','quote',3400,4,null,6);
delete from plan_ideas where invitation_id = :I;
insert into plan_ideas (invitation_id, type, title, body, color, tags, pinned, list_items, sort) values
 (:I,'note','חופה בשקיעה','שעת הזהב ב־19:30 — החופה מול הכרמים','brand','{חופה}',true,'[]',1),
 (:I,'list','שירים לכניסה',null,'info','{מוזיקה}',false,'[{"id":"a","text":"Perfect — Ed Sheeran","done":true},{"id":"b","text":"אהבת נעוריי","done":false},{"id":"c","text":"Can''t Help Falling in Love","done":false}]',2),
 (:I,'note','צבעים','בורדו, שמנת וזהב — כמו ההזמנה','warning','{עיצוב}',false,'[]',3),
 (:I,'note','מתנה לאורחים','צנצנות דבש קטנות עם פתק תודה','success','{אורחים}',false,'[]',4);

-- seating: a head table and twelve rounds on the hall's floor
delete from seat_assignments where invitation_id = :I;
delete from seating_tables where invitation_id = :I;
insert into seating_tables (invitation_id, number, label, shape, capacity, x, y, w, h) values (:I, 1, 'שולחן הזוג', 'knights', 14, 15, 3.5, 7, 1);
insert into seating_tables (invitation_id, number, shape, capacity, x, y, w, h)
select :I, 1 + n, 'round', 10, (array[6,11,19,24])[1 + (n - 1) % 4], (array[9,13.5,18])[1 + (n - 1) / 4], 1.8, 1.8 from generate_series(1, 12) n;
update venue_layouts set landmarks = '[{"id":"stage","kind":"stage","x":15,"y":1,"w":8,"h":1.4,"rotation":0,"label":null},{"id":"dance","kind":"dance","x":15,"y":10.5,"w":5,"h":5,"rotation":0,"label":null},{"id":"bar","kind":"bar","x":28,"y":10,"w":1.5,"h":5,"rotation":0,"label":null},{"id":"door","kind":"entrance","x":15,"y":19.6,"w":3,"h":0.6,"rotation":0,"label":null}]'::jsonb
 where invitation_id = :I;

-- insights: two weeks of visits
delete from insight_daily where invitation_id = :I;
insert into insight_daily (invitation_id, day, visits, opened, read_end, rsvp_started, rsvp_sent, calendar, map, by_device, by_source)
select :I, current_date - d, v, (v * 0.9)::int, (v * 0.7)::int, (v * 0.35)::int, (v * 0.28)::int, (v * 0.2)::int, (v * 0.25)::int,
  jsonb_build_object('mobile', (v * 0.85)::int, 'desktop', (v * 0.15)::int), jsonb_build_object('whatsapp', (v * 0.8)::int, 'link', (v * 0.2)::int)
from (select d, (array[4,6,9,14,22,31,38,27,19,12,9,7,5,6])[d + 1] v from generate_series(0, 13) d) x;
commit;
