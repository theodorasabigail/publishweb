import { ImageUploader } from "@/components/admin/image-uploader";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { TitleAndSlug } from "@/components/admin/slug-input";
import { Field, Panel } from "@/components/admin/ui";
import { createPost, updatePost } from "@/app/admin/_actions/blog";
import type { BlogCategory, BlogPost } from "@/lib/types";

/** ISO timestamp → the value a datetime-local input expects. */
function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function PostForm({
  post,
  categories,
}: {
  post?: BlogPost;
  categories: BlogCategory[];
}) {
  const isEdit = Boolean(post);

  return (
    <form action={isEdit ? updatePost : createPost} className="space-y-6">
      {isEdit && <input type="hidden" name="id" value={post!.id} />}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="space-y-6">
          <Panel>
            <div className="space-y-5">
              <TitleAndSlug
                titleName="title"
                slugName="slug"
                titleLabel="Title"
                defaultTitle={post?.title ?? ""}
                defaultSlug={post?.slug ?? ""}
                prefix="/blog/"
              />

              <Field
                label="Standfirst"
                hint="The line under the title, and what shows in the archive and on social. Left blank, we take the opening of the post."
              >
                <textarea
                  name="excerpt"
                  className="input min-h-20"
                  defaultValue={post?.excerpt ?? ""}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="The post">
            <MarkdownEditor name="body" defaultValue={post?.body ?? ""} />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Publishing">
            <div className="space-y-4">
              <Field label="Status">
                <select name="status" className="input" defaultValue={post?.status ?? "draft"}>
                  <option value="draft">Draft — only you can see it</option>
                  <option value="scheduled">Scheduled — goes live on its own</option>
                  <option value="published">Published — live now</option>
                </select>
              </Field>

              <Field
                label="Publish date"
                hint="For a scheduled post, when it should appear. Leave blank to publish immediately."
              >
                <input
                  type="datetime-local"
                  name="published_at"
                  className="input"
                  defaultValue={toLocalInput(post?.published_at ?? null)}
                />
              </Field>

              <Field label="Category">
                <select
                  name="blog_category_id"
                  className="input"
                  defaultValue={post?.blog_category_id ?? ""}
                >
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Tags" hint="Separated by commas: sumatra, process, roasting">
                <input
                  name="tags"
                  className="input"
                  defaultValue={(post?.tags ?? []).join(", ")}
                />
              </Field>

              <Field label="Author">
                <input
                  name="author_name"
                  className="input"
                  defaultValue={post?.author_name ?? "Publish Coffee Roasters"}
                />
              </Field>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="is_featured"
                  defaultChecked={post?.is_featured ?? false}
                  className="h-4 w-4 rounded border-bark-300"
                />
                Feature at the top of the archive
              </label>
            </div>
          </Panel>

          <Panel title="Cover image">
            <div className="space-y-4">
              <ImageUploader
                name="cover_image"
                label="Image"
                defaultValue={post?.cover_image}
                folder="blog"
              />
              <Field label="Image description">
                <input
                  name="cover_alt"
                  className="input"
                  defaultValue={post?.cover_alt ?? ""}
                  placeholder="Describe the photo"
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Search engines">
            <div className="space-y-4">
              <Field label="Page title">
                <input name="seo_title" className="input" defaultValue={post?.seo_title ?? ""} />
              </Field>
              <Field label="Description">
                <textarea
                  name="seo_description"
                  className="input min-h-16"
                  defaultValue={post?.seo_description ?? ""}
                />
              </Field>
              <ImageUploader
                name="og_image_url"
                label="Social sharing image"
                defaultValue={post?.og_image_url}
                folder="social"
              />
            </div>
          </Panel>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-5 border-t border-bark-200 bg-white/95 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <button type="submit" className="btn-primary">
          {isEdit ? "Save post" : "Create post"}
        </button>
      </div>
    </form>
  );
}
