export type LoyaltyTier = "bronze" | "silver" | "gold";
/**
 * A pack size, as the operator typed it: "200g", "250g", "12oz", "Sample".
 *
 * Was an enum of exactly three values, in the database as well as here, which
 * made adding a size a code change and a deployment. Ordering comes from
 * weight_grams instead, which is more correct anyway -- it puts a new 250g
 * between 200g and 1kg with nobody maintaining a list.
 */
export type VariantSize = string;
export type OrderStatus =
  | "pending"
  | "paid"
  | "roasting"
  | "shipped"
  | "completed"
  | "cancelled";
export type RoastingStatus = "new" | "quoted" | "accepted" | "declined" | "done";
export type PostStatus = "draft" | "scheduled" | "published";
export type SalesChannel = "online" | "pos";

/** Offered as a starting point in the admin, not a limit. */
export const SUGGESTED_SIZES = ["100g", "200g", "250g", "500g", "1kg"];

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "paid",
  "roasting",
  "shipped",
  "completed",
  "cancelled",
];

export const ROASTING_STATUSES: RoastingStatus[] = [
  "new",
  "quoted",
  "accepted",
  "declined",
  "done",
];

export interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  loyalty_points: number;
  lifetime_points: number;
  tier: LoyaltyTier;
  is_admin: boolean;
  created_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  recipient_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  province: string | null;
  postal_code: string | null;
  country: string;
  is_default: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  show_on_homepage: boolean;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  size: VariantSize;
  price_idr: number;
  stock: number;
  weight_grams: number;
  is_active: boolean;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  origin: string | null;
  process: string | null;
  roast_level: string | null;
  varietal: string | null;
  masl: string | null;
  tasting_notes: string | null;
  category_id: string | null;
  image_url: string | null;
  image_alt: string | null;
  accent_color: string;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductWithVariants extends Product {
  product_variants: ProductVariant[];
  categories?: Pick<Category, "id" | "slug" | "name"> | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  name_snapshot: string;
  size_snapshot: string;
  slug_snapshot: string | null;
  unit_price_idr: number;
  quantity: number;
}

export interface ShippingAddressSnapshot {
  recipient_name: string;
  phone: string;
  email?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  province?: string | null;
  postal_code?: string | null;
  country: string;
}

export interface Order {
  id: string;
  human_ref: string;
  /** Where the sale happened. Counter sales carry no address or shipping. */
  channel: SalesChannel;
  cash_received_idr: number | null;
  staff_id: string | null;
  user_id: string | null;
  guest_email: string | null;
  status: OrderStatus;
  subtotal_idr: number;
  /** What the customer was charged for shipping. */
  shipping_idr: number;
  /** What the roastery absorbed on this order's shipping. */
  shipping_discount_idr: number;
  unique_code: number;
  total_idr: number;
  payment_method: string | null;
  payment_ref: string | null;
  payment_url: string | null;
  payment_expires_at: string | null;
  shipping_address: ShippingAddressSnapshot | null;
  shipping_zone: string | null;
  courier_note: string | null;
  tracking_number: string | null;
  customer_note: string | null;
  points_awarded: number;
  /** Courier-side identifiers, populated by courier webhooks. */
  courier_order_id: string | null;
  courier_tracking_id: string | null;
  courier_waybill_id: string | null;
  courier_company: string | null;
  courier_type: string | null;
  courier_status: string | null;
  courier_driver_name: string | null;
  courier_driver_phone: string | null;
  /** What the courier actually charged, which can exceed what the customer
   *  paid when real weight differs from quoted weight. */
  courier_charged_idr: number | null;
  /** Set once the receipt has been sent, so a redelivered payment webhook
   *  cannot send a second one. */
  confirmation_email_sent_at: string | null;
  /** The tracking number the customer was last emailed. */
  shipped_email_tracking: string | null;
  created_at: string;
  paid_at: string | null;
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

export interface RoastingRequest {
  id: string;
  human_ref: string;
  user_id: string | null;
  contact_name: string;
  contact_phone: string;
  email: string | null;
  green_bean_origin: string;
  quantity_kg: number;
  desired_roast_level: string | null;
  notes: string | null;
  status: RoastingStatus;
  quoted_price_idr: number | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  accent_color: string;
  sort_order: number;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  cover_image: string | null;
  cover_alt: string | null;
  author_name: string;
  blog_category_id: string | null;
  tags: string[];
  status: PostStatus;
  is_featured: boolean;
  reading_minutes: number | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogPostWithCategory extends BlogPost {
  blog_categories?: Pick<BlogCategory, "id" | "slug" | "name" | "accent_color"> | null;
}

export interface ShippingZone {
  id: string;
  code: string;
  name: string;
  country_codes: string[];
  is_domestic: boolean;
  base_rate_idr: number;
  threshold_grams: number;
  heavy_rate_idr: number;
  free_shipping_over_idr: number | null;
  /** Spend at or above this for a partial subsidy. Null disables it. */
  subsidy_over_idr: number | null;
  /** Flat rupiah off the shipping rate, capped at the rate itself. */
  subsidy_idr: number;
  delivery_estimate: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface SiteSettings {
  id: boolean;
  hero_image: string | null;
  hero_title: string;
  hero_subtitle: string | null;
  hero_cta_label: string | null;
  hero_cta_href: string | null;
  banner_enabled: boolean;
  banner_image: string | null;
  banner_text: string | null;
  banner_link: string | null;
  homepage_category_ids: string[];
  featured_post_id: string | null;
  announcement_note: string | null;
  loyalty_rupiah_per_point: number;
  tier_silver_threshold: number;
  tier_gold_threshold: number;
  whatsapp_number: string | null;
  instagram_url: string | null;
  contact_email: string | null;
  seo_title: string;
  seo_description: string | null;
  og_image_url: string | null;
  /** Where parcels ship from. Only needed by live-rate couriers. */
  origin_contact_name: string | null;
  origin_phone: string | null;
  origin_address: string | null;
  origin_city: string | null;
  origin_province: string | null;
  origin_postal_code: string | null;
  origin_area_code: string | null;
  origin_note: string | null;
  /** How large a courier overcharge has to be before it is worth flagging. */
  courier_variance_alert_idr: number;
  updated_at: string;
}

export interface PaymentEvent {
  id: string;
  provider: string;
  external_id: string | null;
  amount_idr: number | null;
  status: string | null;
  matched_order_id: string | null;
  is_matched: boolean;
  is_resolved: boolean;
  payload: unknown;
  created_at: string;
}

export interface LoyaltyLedgerEntry {
  id: string;
  user_id: string;
  order_id: string | null;
  points: number;
  reason: string;
  created_by: string | null;
  created_at: string;
}
