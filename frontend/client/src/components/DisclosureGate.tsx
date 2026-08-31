/**
 * Cloud data disclosure.
 *
 * The backend gates /chat and /posts/{id}/ai-answer behind require_disclosure(),
 * so this has to be accepted once before any AI call. Styled to the ShefGuide
 * design system rather than the browser's own dialog chrome.
 */
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { acceptDisclosure, hasAcceptedDisclosure } from "@/lib/api";
import { ShieldCheck } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export function useDisclosure() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const resolverRef = useRef<{
    resolve: () => void;
    reject: (reason?: unknown) => void;
  } | null>(null);

  /** Resolves once consent is on record; rejects if the student cancels. */
  const ensureDisclosure = useCallback(() => {
    if (hasAcceptedDisclosure()) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      resolverRef.current = { resolve, reject };
      setOpen(true);
    });
  }, []);

  const handleAccept = async () => {
    setPending(true);
    try {
      await acceptDisclosure();
      setOpen(false);
      resolverRef.current?.resolve();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not record your choice."
      );
      setOpen(false);
      resolverRef.current?.reject(error);
    } finally {
      setPending(false);
      resolverRef.current = null;
    }
  };

  const handleCancel = () => {
    setOpen(false);
    resolverRef.current?.reject(new Error("cancelled"));
    resolverRef.current = null;
  };

  const dialog = (
    <Dialog open={open} onOpenChange={next => !next && handleCancel()}>
      <DialogContent className="max-w-[460px] border-[#DED6C8] bg-[#FFFCF6]">
        <DialogHeader>
          <span className="mb-1 grid size-11 place-items-center bg-[#EEF2FF] text-brand">
            <ShieldCheck className="size-5" />
          </span>
          <DialogTitle className="text-balance t-subhead text-ink">
            Before you continue
          </DialogTitle>
          <DialogDescription className="max-w-[56ch] pt-1 text-pretty t-body-sm text-ink-muted">
            ShefGuide&rsquo;s AI features send your message to OpenAI or
            Google&rsquo;s servers to generate a response. Please don&rsquo;t
            include sensitive personal data in your questions.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="border-[#DCD4C7] bg-white t-label text-ink-muted"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAccept}
            disabled={pending}
            className="bg-brand t-label text-white hover:bg-brand-deep"
          >
            {pending ? "Saving…" : "I understand, continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { ensureDisclosure, disclosureDialog: dialog };
}
