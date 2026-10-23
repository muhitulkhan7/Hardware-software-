CREATE TABLE `photo_lookups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`visible_text` text,
	`candidate_ids` text NOT NULL,
	`chosen_product_id` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`chosen_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sku` text NOT NULL,
	`barcode` text,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`unit` text NOT NULL,
	`cost_price` integer NOT NULL,
	`sell_price` integer NOT NULL,
	`stock_qty` real DEFAULT 0 NOT NULL,
	`low_stock_threshold` real DEFAULT 0 NOT NULL,
	`image_url` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "products_prices_non_negative" CHECK("products"."cost_price" >= 0 AND "products"."sell_price" >= 0),
	CONSTRAINT "products_stock_non_negative" CHECK("products"."stock_qty" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_barcode_unique` ON `products` (`barcode`);--> statement-breakpoint
CREATE TABLE `receipts_in` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`supplier_id` integer NOT NULL,
	`qty` real NOT NULL,
	`unit_cost` integer NOT NULL,
	`total` integer NOT NULL,
	`received_date` text NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "receipts_in_qty_positive" CHECK("receipts_in"."qty" > 0)
);
--> statement-breakpoint
CREATE TABLE `return_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`return_id` integer NOT NULL,
	`sale_item_id` integer NOT NULL,
	`qty` real NOT NULL,
	`unit_refund` integer NOT NULL,
	`refund_total` integer NOT NULL,
	`restock` integer NOT NULL,
	FOREIGN KEY (`return_id`) REFERENCES `returns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "return_items_qty_positive" CHECK("return_items"."qty" > 0)
);
--> statement-breakpoint
CREATE TABLE `returns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`return_no` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`sale_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`reason` text NOT NULL,
	`refund_total` integer NOT NULL,
	`refund_method` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `returns_return_no_unique` ON `returns` (`return_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `returns_idempotency_key_unique` ON `returns` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`name_snapshot` text NOT NULL,
	`sku_snapshot` text NOT NULL,
	`unit_price` integer NOT NULL,
	`cost_snapshot` integer NOT NULL,
	`qty` real NOT NULL,
	`line_subtotal` integer NOT NULL,
	`line_discount` integer NOT NULL,
	`line_tax` integer NOT NULL,
	`line_total` integer NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sale_items_qty_positive" CHECK("sale_items"."qty" > 0)
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_no` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`cashier_id` integer NOT NULL,
	`subtotal` integer NOT NULL,
	`discount_type` text NOT NULL,
	`discount_value` integer NOT NULL,
	`discount_total` integer NOT NULL,
	`tax_rate_bp` integer NOT NULL,
	`tax_total` integer NOT NULL,
	`total` integer NOT NULL,
	`payment_method` text NOT NULL,
	`amount_received` integer NOT NULL,
	`change_due` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`cashier_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_invoice_no_unique` ON `sales` (`invoice_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `sales_idempotency_key_unique` ON `sales` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`tax_rate_bp` integer DEFAULT 0 NOT NULL,
	`max_discount_pct` integer DEFAULT 20 NOT NULL,
	`default_low_stock_threshold` real DEFAULT 5 NOT NULL,
	`currency` text DEFAULT 'BDT' NOT NULL,
	`store_name` text DEFAULT 'Westlands Store' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`type` text NOT NULL,
	`qty_change` real NOT NULL,
	`qty_after` real NOT NULL,
	`reason_code` text,
	`note` text,
	`ref_type` text,
	`ref_id` integer,
	`user_id` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suppliers_name_unique` ON `suppliers` (`name`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);