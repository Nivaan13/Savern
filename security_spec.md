# Savern Firestore Security Specification

## 1. Data Invariants
1. **Strict Tenant Isolation**: Every financial subcollection lives under `/users/{userId}/...`. A verified user (`request.auth.uid == userId && request.auth.token.email_verified == true`) may only read/write within their own `{userId}` subtree.
2. **Identity Integrity**: Every document's `userId` field (or `uid` on private profile) must equal `request.auth.uid` on create and remain immutable on update.
3. **Path & Document ID Hardening**: All path IDs (`userId`, `accountId`, `transactionId`, etc.) must satisfy `isValidId(id)` (`size() <= 128 && matches('^[a-zA-Z0-9_\\-]+$')`).
4. **No Shadow Fields**: Every `create` checks `keys().hasAll(...)` and `keys().hasOnly(...)`; every `update` checks `affectedKeys().hasOnly(...)` and runs the full `isValid[Entity](incoming())` validator.
5. **Temporal Integrity**: `createdAt == request.time` on create and `createdAt == existing().createdAt` + `updatedAt == request.time` on update.
6. **PII Isolation**: User email and display name live strictly in `/users/{userId}/private/profile` with owner-only read/write.
7. **No Blanket List Queries**: All `list` rules require `isVerifiedOwner(userId)` AND `resource.data.userId == request.auth.uid`.

## 2. "Dirty Dozen" Adversarial Payloads (All Must Fail with PERMISSION_DENIED)
1. **Cross-user read**: User B attempts `get(/users/userA/transactions/tx1)`.
2. **Cross-user write**: User B attempts `create(/users/userA/accounts/acc1)` with `userId: userA`.
3. **UID spoofing in body**: User A attempts `create(/users/userA/transactions/tx1)` with `userId: userB`.
4. **Unverified email write**: Unverified token (`email_verified: false`) attempts `create(/users/userA/accounts/acc1)`.
5. **Shadow field injection**: User A sends `isAdmin: true` or `ghostField: 1` on transaction create.
6. **1MB string DoS**: User A sends a 5,000-character `description` on transaction create.
7. **Invalid document ID poisoning**: User A attempts `create(/users/userA/accounts/bad$id..with.chars)`.
8. **Negative transaction amount**: User A attempts `create(/users/userA/transactions/tx1)` with `amount: -500`.
9. **Immutable `userId` mutation**: User A attempts to update `userId` to `userB` on an existing goal.
10. **Client-forged timestamp**: User A sends a past string or non-server timestamp for `createdAt` or `updatedAt`.
11. **Terminal state bypass**: User A attempts to reopen a `reimbursement_received` medical claim back to `draft` without allowed state fields.
12. **Blanket root read**: Any user attempts `get(/users/userA)` or `list(/users)` or `list(/test)`.
