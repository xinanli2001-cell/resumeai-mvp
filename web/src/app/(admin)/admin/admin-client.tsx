"use client";

import { FormEvent, useState } from "react";
import { getAdminInvitationStatus } from "@/lib/invitations/admin-status";

const adminDateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Australia/Sydney",
});

function formatAdminDateTime(value: string) {
  return adminDateTimeFormatter.format(new Date(value));
}

type AdminUser = {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  quotaLimit: number;
  quotaUsed: number;
  createdAt: string;
  usageLogs: {
    id: string;
    actionType: string;
    costUnits: number;
    status: string;
    createdAt: string;
  }[];
};

type AdminInvitation = {
  id: string;
  code: string;
  label: string;
  maxUses: number;
  usedCount: number;
  bonusQuota: number;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  redemptions: Array<{
    bonusQuota: number;
    redeemedAt: string;
    user: { email: string };
  }>;
};

export function AdminClient({
  initialUsers,
  initialInvitations,
}: {
  initialUsers: AdminUser[];
  initialInvitations: AdminInvitation[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [message, setMessage] = useState("");
  const [invitationBusy, setInvitationBusy] = useState(false);
  const usageLogs = users.flatMap((user) =>
    user.usageLogs.map((log) => ({ ...log, userEmail: user.email })),
  );

  async function saveUser(user: AdminUser) {
    setMessage("");
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: user.id, role: user.role, quotaLimit: user.quotaLimit }),
    });
    if (!response.ok) {
      setMessage("保存失败");
      return;
    }
    const body = await response.json();
    setUsers((current) =>
      current.map((item) => (item.id === user.id ? { ...item, ...body.user } : item)),
    );
    setMessage("用户设置已保存");
  }

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInvitationBusy(true);
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const expiresAt = String(data.get("expiresAt") ?? "");

    try {
      const response = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: String(data.get("label") ?? ""),
          maxUses: Number(data.get("maxUses")),
          bonusQuota: Number(data.get("bonusQuota")),
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(body.error ?? "邀请码创建失败");
        return;
      }

      setInvitations((current) => [
        { ...body.invitation, redemptions: [] },
        ...current,
      ]);
      form.reset();
      setMessage("邀请码已创建");
    } catch {
      setMessage("邀请码创建失败，请检查网络后重试");
    } finally {
      setInvitationBusy(false);
    }
  }

  async function copyInvitation(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setMessage("邀请码已复制");
    } catch {
      setMessage("复制失败，请手动复制邀请码");
    }
  }

  async function setInvitationActive(invitation: AdminInvitation, active: boolean) {
    setInvitationBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/invitations/${invitation.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(body.error ?? "邀请码状态更新失败");
        return;
      }
      setInvitations((current) =>
        current.map((item) =>
          item.id === invitation.id ? { ...item, active: body.invitation.active } : item,
        ),
      );
      setMessage(active ? "邀请码已启用" : "邀请码已停用");
    } catch {
      setMessage("邀请码状态更新失败，请检查网络后重试");
    } finally {
      setInvitationBusy(false);
    }
  }

  return (
    <div className="space-y-6 p-5 sm:p-7">
      {message ? (
        <p
          className="border border-[#b9c9e5] bg-[#eef4ff] px-4 py-3 text-sm text-[#1749b2]"
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      ) : null}

      <section className="border border-[#d5e0f2] bg-white">
        <div className="flex items-center justify-between border-b border-[#d5e0f2] px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#4972bd]">Accounts</p>
            <h2 className="mt-1 font-semibold">用户列表</h2>
          </div>
          <span className="bg-[#eef4ff] px-2.5 py-1 text-xs font-bold text-[#1e5bd7]">
            {users.length} 位用户
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[#f6f9ff] text-left text-xs uppercase tracking-wide text-[#5d7297]">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Quota Limit</th>
                <th className="px-4 py-3">Used</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-[#e1e9f6] hover:bg-[#f8fbff]">
                  <td className="px-4 py-3 font-medium">{user.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      onChange={(event) =>
                        setUsers((current) =>
                          current.map((item) =>
                            item.id === user.id
                              ? { ...item, role: event.target.value as AdminUser["role"] }
                              : item,
                          ),
                        )
                      }
                      className="border border-[#b9c9e5] bg-white px-2 py-1 outline-none focus:border-[#1e5bd7]"
                    >
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {user.role === "ADMIN" ? (
                      <span className="font-semibold text-[#1e5bd7]">Unlimited usage</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        value={user.quotaLimit}
                        onChange={(event) =>
                          setUsers((current) =>
                            current.map((item) =>
                              item.id === user.id
                                ? { ...item, quotaLimit: Number(event.target.value) }
                                : item,
                            ),
                          )
                        }
                        className="w-24 border border-[#b9c9e5] bg-white px-2 py-1 outline-none focus:border-[#1e5bd7]"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">{user.quotaUsed}</td>
                  <td className="px-4 py-3">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => saveUser(user)}
                      className="bg-[#1e5bd7] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1749b2]"
                    >
                      Save
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border border-[#d5e0f2] bg-white">
        <div className="border-b border-[#d5e0f2] px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#4972bd]">Invitations</p>
          <h2 className="mt-1 font-semibold">邀请码</h2>
          <p className="mt-1 text-sm text-[#667995]">创建、复制、查看兑换历史并控制后续使用。</p>
        </div>
        <form
          onSubmit={createInvitation}
          aria-busy={invitationBusy}
          className="grid gap-4 border-b border-[#d5e0f2] bg-[#f8fbff] p-5 sm:grid-cols-2 xl:grid-cols-[minmax(220px,2fr)_minmax(130px,1fr)_minmax(130px,1fr)_minmax(190px,1fr)_auto] xl:items-end"
        >
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-[#40577b]">邀请码标签</span>
            <input
              name="label"
              required
              maxLength={120}
              className="mt-2 w-full border border-[#b9c9e5] bg-white px-3 py-2 text-sm outline-none focus:border-[#1e5bd7]"
              placeholder="July beta friends"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-[#40577b]">最大使用次数</span>
            <input
              name="maxUses"
              type="number"
              min={1}
              required
              defaultValue={1}
              className="mt-2 w-full border border-[#b9c9e5] bg-white px-3 py-2 text-sm outline-none focus:border-[#1e5bd7]"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-[#40577b]">每次赠送额度</span>
            <input
              name="bonusQuota"
              type="number"
              min={1}
              required
              defaultValue={5}
              className="mt-2 w-full border border-[#b9c9e5] bg-white px-3 py-2 text-sm outline-none focus:border-[#1e5bd7]"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-[#40577b]">到期时间（可选）</span>
            <input
              name="expiresAt"
              type="datetime-local"
              className="mt-2 w-full border border-[#b9c9e5] bg-white px-3 py-2 text-sm outline-none focus:border-[#1e5bd7]"
            />
          </label>
          <button
            type="submit"
            disabled={invitationBusy}
            className="w-full bg-[#1e5bd7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1749b2] disabled:opacity-50 xl:w-auto"
          >
            {invitationBusy ? "创建中..." : "创建邀请码"}
          </button>
        </form>
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full border-collapse text-sm">
            <thead className="bg-[#f6f9ff] text-left text-xs uppercase tracking-wide text-[#5d7297]">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Label</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Uses</th>
                <th className="px-4 py-3">Grant</th>
                <th className="px-4 py-3">Expiry</th>
                <th className="px-4 py-3">Recent redemptions</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {invitations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#667995]">
                    暂无邀请码。
                  </td>
                </tr>
              ) : (
                invitations.map((invitation) => {
                  const expired =
                    invitation.expiresAt !== null && new Date(invitation.expiresAt) <= new Date();
                  const status = getAdminInvitationStatus(invitation);
                  return (
                    <tr key={invitation.id} className="border-t border-[#e1e9f6] align-top">
                      <td className="px-4 py-3">
                        <code data-testid="invitation-code" className="font-semibold text-[#173a79]">
                          {invitation.code}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyInvitation(invitation.code)}
                          className="ml-3 border border-[#b9c9e5] px-2 py-1 text-xs font-semibold text-[#1e5bd7] hover:bg-[#eef4ff]"
                        >
                          复制
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium">{invitation.label}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs font-bold ${
                            status === "可用"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {invitation.usedCount} / {invitation.maxUses}
                      </td>
                      <td className="px-4 py-3">+{invitation.bonusQuota}</td>
                      <td className="px-4 py-3">
                        {invitation.expiresAt
                          ? formatAdminDateTime(invitation.expiresAt)
                          : "不过期"}
                      </td>
                      <td className="px-4 py-3">
                        {invitation.redemptions.length === 0 ? (
                          <span className="text-[#7a8ba5]">暂无兑换</span>
                        ) : (
                          <ul className="space-y-1">
                            {invitation.redemptions.map((redemption) => (
                              <li key={`${redemption.user.email}-${redemption.redeemedAt}`}>
                                <span className="font-medium">{redemption.user.email}</span>
                                <span className="block text-xs text-[#7a8ba5]">
                                  {formatAdminDateTime(redemption.redeemedAt)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={invitationBusy || (!invitation.active && expired)}
                          onClick={() => setInvitationActive(invitation, !invitation.active)}
                          className="border border-[#b9c9e5] px-3 py-2 text-xs font-semibold text-[#1e5bd7] hover:bg-[#eef4ff] disabled:opacity-50"
                        >
                          {invitation.active ? "停用" : "启用"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border border-[#d5e0f2] bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#4972bd]">Activity</p>
        <h2 className="mb-4 mt-1 font-semibold">最近生成 / 用量记录</h2>
        <div className="grid gap-3">
          {usageLogs.length === 0 ? (
            <p className="text-sm text-[#667995]">暂无生成记录。</p>
          ) : (
            usageLogs.map((log) => (
              <div key={log.id} className="border border-[#e1e9f6] bg-[#f8fbff] px-4 py-3 text-sm">
                <span className="font-semibold">{log.userEmail}</span> · {log.actionType} · {log.costUnits} units ·{" "}
                {log.status}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
