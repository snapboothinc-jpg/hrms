import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getFileUrl, registerFile } from "@/lib/api/actions.functions";
import { unwrap, ApiError } from "@/lib/api/result";
import { ALLOWED_MIME, MAX_FILE_BYTES } from "@/lib/schemas";
import { Button } from "@/components/ui/button";

/** Uploads to the private evidence bucket under a random key, then verifies type by content on the server. */
export function EvidenceUpload({
  employeeId,
  onUploaded,
  disabled,
}: {
  employeeId: string;
  onUploaded: (fileId: string) => Promise<void> | void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const register = useServerFn(registerFile);
  async function onFile(f: File) {
    if (f.size > MAX_FILE_BYTES) {
      toast.error("File is larger than 10 MB");
      return;
    }
    if (!(ALLOWED_MIME as readonly string[]).includes(f.type)) {
      toast.error("Allowed: PDF, PNG, JPEG, DOCX or plain text");
      return;
    }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Please sign in again");
      const path = `${u.user.id}/${crypto.randomUUID()}`;
      const up = await supabase.storage
        .from("evidence")
        .upload(path, f, { contentType: f.type, upsert: false });
      if (up.error) throw new Error("Upload failed");
      const meta = unwrap(
        await register({ data: { path, name: f.name, size: f.size, employee_id: employeeId } }),
      );
      await onUploaded(meta.id);
      toast.success("Evidence attached");
    } catch (e) {
      toast.error(e instanceof ApiError || e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }
  return (
    <>
      <input
        ref={ref}
        type="file"
        className="sr-only"
        aria-label="Evidence file"
        accept={ALLOWED_MIME.join(",")}
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy || disabled}
        onClick={() => ref.current?.click()}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Paperclip />} Attach file
      </Button>
    </>
  );
}

export function EvidenceFileLink({ fileId, name }: { fileId: string; name: string }) {
  const fn = useServerFn(getFileUrl);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline disabled:opacity-50"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { url } = unwrap(await fn({ data: { file_id: fileId } }));
          window.open(url, "_blank", "noopener,noreferrer");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not open file");
        } finally {
          setBusy(false);
        }
      }}
    >
      <FileText className="size-4" aria-hidden /> {name}
    </button>
  );
}
