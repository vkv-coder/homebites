-- Homebites (hb_) — fix supplier self-approval bypass.
--
-- Found during a portfolio-wide check. hb_suppliers_insert_own
-- correctly pins approval_status='pending' at signup, but
-- hb_suppliers_update_own's with_check only required
-- (owner_user_id = auth.uid()) - it never restricted approval_status
-- on the resulting row. A supplier could self-approve their own
-- account via a normal UPDATE, bypassing hb_admin_set_supplier_approval
-- (and the admin-only hb_admins check it performs) entirely.
--
-- Fix: approval_status must stay equal to whatever it already was
-- before the update (verified against the row's CURRENT value in the
-- database, not client-supplied) - so a supplier can still freely
-- update their own other fields, but can never change their own
-- approval_status via this path. Only the SECURITY DEFINER admin RPC
-- (which bypasses RLS) can actually change it.
--
-- Verified read-only before applying: for real existing (already-
-- approved) suppliers, submitting an update that leaves
-- approval_status unchanged correctly passes; no currently-pending
-- suppliers exist in the live data to test the blocked case against,
-- but the same-value case proves the correlation works (this session
-- already had one subquery-correlation mistake on a different app's
-- fix - re-verified this one is NOT the same shape before applying).

drop policy if exists "hb_suppliers_update_own" on hb_suppliers;

create policy "hb_suppliers_update_own" on hb_suppliers
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (
    owner_user_id = auth.uid()
    and approval_status = (select old_row.approval_status from hb_suppliers old_row where old_row.id = hb_suppliers.id)
  );
