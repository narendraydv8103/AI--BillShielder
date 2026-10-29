<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules

- BillShielder is frontend-only: no backend, database or auth. All demo data comes from `src/lib/demo-audit.ts` (total ₹1,01,540, flagged ₹45,000, 44.3%, 7 findings). Why: the user asked for the frontend only, matching the approved design PDFs exactly.
