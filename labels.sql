UPDATE reciter_links SET label='تلاوة المصحف كاملاً (mp3quran.net) — الفاتحة' WHERE label LIKE 'Full Quran audio%';
UPDATE reciter_links SET label='آية بآية (everyayah.com)' WHERE label LIKE 'Verse by verse%';
UPDATE reciter_links SET label='بحث في يوتيوب (بالإنجليزية)' WHERE label='Search on YouTube';
UPDATE reciter_links SET label='بحث في يوتيوب (بالعربية)' WHERE label='بحث في يوتيوب';
UPDATE reciter_links SET label='بحث في سبوتيفاي' WHERE label='Search on Spotify';
DELETE FROM reciter_bios;
