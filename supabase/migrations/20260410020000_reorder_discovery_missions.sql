-- Reorder discovery missions: first 5 introduce different employees
-- (WOW tour), then deeper missions follow.
-- Old: portfoy → portfoy → portfoy → analist → satis × 4 → analist → medya → sekreter
-- New: portfoy → analist → sekreter → medya → satis → then deeper...

UPDATE platform_missions SET sort_order = 1, next_mission = 'emlak_ilk_analiz' WHERE mission_key = 'emlak_ilk_mulk';
UPDATE platform_missions SET sort_order = 2, next_mission = 'emlak_ilk_brifing' WHERE mission_key = 'emlak_ilk_analiz';
UPDATE platform_missions SET sort_order = 3, next_mission = 'emlak_ilk_paylas' WHERE mission_key = 'emlak_ilk_brifing';
UPDATE platform_missions SET sort_order = 4, next_mission = 'emlak_ilk_musteri' WHERE mission_key = 'emlak_ilk_paylas';
UPDATE platform_missions SET sort_order = 5, next_mission = 'emlak_mulk_bilgi_tamamla' WHERE mission_key = 'emlak_ilk_musteri';
UPDATE platform_missions SET sort_order = 6, next_mission = 'emlak_mulk_foto' WHERE mission_key = 'emlak_mulk_bilgi_tamamla';
UPDATE platform_missions SET sort_order = 7, next_mission = 'emlak_fiyat_kontrol' WHERE mission_key = 'emlak_mulk_foto';
UPDATE platform_missions SET sort_order = 8, next_mission = 'emlak_ilk_eslestirme' WHERE mission_key = 'emlak_fiyat_kontrol';
UPDATE platform_missions SET sort_order = 9, next_mission = 'emlak_ilk_sunum' WHERE mission_key = 'emlak_ilk_eslestirme';
UPDATE platform_missions SET sort_order = 10, next_mission = 'emlak_ilk_takip' WHERE mission_key = 'emlak_ilk_sunum';
UPDATE platform_missions SET sort_order = 11, next_mission = NULL WHERE mission_key = 'emlak_ilk_takip';
