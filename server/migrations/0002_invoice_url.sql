-- 原始发票文件 URL(Cloudinary),PRD §5.3 数据模型 invoice_image_url
alter table bills add column invoice_url text;
