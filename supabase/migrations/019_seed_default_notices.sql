-- 019_seed_default_notices.sql
-- Seed default institutional notices into notices table if none exist

INSERT INTO public.notices (title, content, is_active, created_at, notice_date)
SELECT
  'ভর্তি বিজ্ঞপ্তি : ২০২৫-২৬ সেশনে ভর্তি কার্যক্রম চলমান রয়েছে।',
  'সকল শাখার সকল ব্যাচে নতুন সেশনের ক্লাস আগামী ১০ তারিখ হতে শুরু হবে। আসন সংখ্যা সীমিত বিধায় দ্রুত যোগাযোগ করুন।',
  true,
  NOW(),
  CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM public.notices LIMIT 1);

INSERT INTO public.notices (title, content, is_active, created_at, notice_date)
SELECT
  'এইচএসসি মডেল টেস্ট ২০২৬ এর সময়সূচি প্রকাশিত হয়েছে।',
  'আগামী রবিবার হতে পদার্থবিজ্ঞান ও রসায়ন মডেল টেস্টের চূড়ান্ত সময়সূচি অনুযায়ী পরীক্ষা গ্রহণ করা হবে।',
  true,
  NOW() - INTERVAL '2 days',
  CURRENT_DATE - INTERVAL '2 days'
WHERE (SELECT COUNT(*) FROM public.notices) = 1;

INSERT INTO public.notices (title, content, is_active, created_at, notice_date)
SELECT
  'অভিভাবক সমাবেশ ও ত্রৈমাসিক ফলাফল প্রকাশ সংক্রান্ত নোটিশ।',
  'সকল অভিভাবকবৃন্দকে আগামী শুক্রবারে কোচিং অডিটোরিয়ামে উপস্থিত থাকার জন্য বিনীত অনুরোধ করা হচ্ছে।',
  true,
  NOW() - INTERVAL '5 days',
  CURRENT_DATE - INTERVAL '5 days'
WHERE (SELECT COUNT(*) FROM public.notices) = 2;

-- Mark seeded in site_settings so automatic re-seeding does not occur if an admin deletes all notices
INSERT INTO public.site_settings (key, value)
VALUES ('notices_seeded', 'true')
ON CONFLICT (key) DO NOTHING;
