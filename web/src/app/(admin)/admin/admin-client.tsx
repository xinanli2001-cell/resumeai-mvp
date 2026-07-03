"use client";

import { useState } from "react";

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

export function AdminClient({ initialUsers }: { initialUsers: AdminUser[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [message, setMessage] = useState("");
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
    setUsers((current) => current.map((item) => (item.id === user.id ? { ...item, ...body.user } : item)));
    setMessage("用户设置已保存");
  }

  return (
    <div className="space-y-6 p-6">
      {message ? <p className="rounded border border-[#d8c3ad] bg-white px-4 py-3 text-sm">{message}</p> : null}
      <section className="rounded-lg border border-[#d8c3ad] bg-white shadow-sm">
        <div className="border-b border-[#d8c3ad] px-5 py-4">
          <h2 className="font-semibold">用户列表</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[#eff4ff] text-left text-xs uppercase tracking-wide text-[#565e74]">
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
                <tr key={user.id} className="border-t border-[#d8c3ad]">
                  <td className="px-4 py-3 font-medium">{user.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      onChange={(event) =>
                        setUsers((current) =>
                          current.map((item) =>
                            item.id === user.id ? { ...item, role: event.target.value as AdminUser["role"] } : item,
                          ),
                        )
                      }
                      className="rounded border border-[#d8c3ad] bg-[#f8f9ff] px-2 py-1"
                    >
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {user.role === "ADMIN" ? (
                      <span className="font-semibold text-[#855300]">Unlimited usage</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        value={user.quotaLimit}
                        onChange={(event) =>
                          setUsers((current) =>
                            current.map((item) =>
                              item.id === user.id ? { ...item, quotaLimit: Number(event.target.value) } : item,
                            ),
                          )
                        }
                        className="w-24 rounded border border-[#d8c3ad] bg-[#f8f9ff] px-2 py-1"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">{user.quotaUsed}</td>
                  <td className="px-4 py-3">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => saveUser(user)}
                      className="rounded bg-[#855300] px-3 py-2 text-xs font-semibold text-white"
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

      <section className="rounded-lg border border-[#d8c3ad] bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold">最近生成 / 用量记录</h2>
        <div className="grid gap-3">
          {usageLogs.length === 0 ? (
            <p className="text-sm text-[#565e74]">暂无生成记录。</p>
          ) : (
            usageLogs.map((log) => (
              <div key={log.id} className="rounded border border-[#d8c3ad] bg-[#f8f9ff] px-4 py-3 text-sm">
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
