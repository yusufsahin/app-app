import { useEffect, useRef } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { UserMinus } from "lucide-react";
import { Button } from "../../components/ui";
import { RhfSelect } from "../../components/forms";
import {
  useProjectMembers,
  useOrgMembers,
  useAddProjectMember,
  useRemoveProjectMember,
  useUpdateProjectMember,
} from "../../api/orgApi";
import { useNotificationStore } from "../../stores/notificationStore";
import type { ProjectMembersModalProps } from "../modalTypes";

type Props = ProjectMembersModalProps & { onClose: () => void };

function ProjectMemberRow({
  pm,
  memberLabel,
  isOnlyAdmin,
  onUpdateRole,
  isUpdating,
  onRemove,
  isRemoving,
}: {
  pm: { id: string; user_id: string; role: string };
  memberLabel: string;
  isOnlyAdmin: boolean;
  onUpdateRole: (userId: string, role: string) => void;
  isUpdating: boolean;
  onRemove: (userId: string) => void;
  isRemoving: boolean;
}) {
  type RoleValues = { role: string };
  const rowForm = useForm<RoleValues>({ defaultValues: { role: pm.role } });
  const justResetRef = useRef(false);
  useEffect(() => {
    rowForm.reset({ role: pm.role });
    justResetRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when pm.role changes; rowForm omitted
  }, [pm.role]);
  const watchedRole = rowForm.watch("role");
  useEffect(() => {
    if (justResetRef.current) {
      justResetRef.current = false;
      return;
    }
    if (watchedRole !== pm.role) {
      onUpdateRole(pm.user_id, watchedRole);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when watchedRole changes; onUpdateRole/pm omitted to avoid loops
  }, [watchedRole]);

  return (
    <li className="flex list-none items-center justify-between gap-2 border-b border-border py-2 last:border-0">
      <span className="text-sm">{memberLabel}</span>
      <div className="flex items-center gap-2">
        <FormProvider {...rowForm}>
          <RhfSelect<RoleValues>
            name="role"
            control={rowForm.control}
            label=""
            options={[
              { value: "PROJECT_VIEWER", label: "Viewer" },
              { value: "PROJECT_CONTRIBUTOR", label: "Contributor" },
              { value: "PROJECT_ADMIN", label: "Admin" },
            ]}
            selectProps={{ size: "sm", disabled: isUpdating }}
          />
        </FormProvider>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Remove member"
          disabled={isRemoving || isOnlyAdmin}
          title={isOnlyAdmin ? "Cannot remove the last admin" : "Remove member"}
          onClick={() => onRemove(pm.user_id)}
        >
          <UserMinus className="size-4" />
        </Button>
      </div>
    </li>
  );
}

type AddMemberFormValues = { user_id: string; role: string };

export function ProjectMembersModal({ orgSlug, projectId, projectName: _projectName, onClose }: Props) {
  const showNotification = useNotificationStore((s) => s.showNotification);
  const { data: projectMembers, isLoading: projectMembersLoading } = useProjectMembers(
    orgSlug,
    projectId,
  );
  const { data: members } = useOrgMembers(orgSlug);
  const addProjectMemberMutation = useAddProjectMember(orgSlug, projectId);
  const removeProjectMemberMutation = useRemoveProjectMember(orgSlug, projectId);
  const updateProjectMemberMutation = useUpdateProjectMember(orgSlug, projectId);

  const addMemberForm = useForm<AddMemberFormValues>({
    defaultValues: { user_id: "", role: "PROJECT_VIEWER" },
  });

  const availableMembersForAdd = (members ?? []).filter(
    (m) => !(projectMembers ?? []).some((pm) => pm.user_id === m.user_id),
  );

  const onSubmitAddMember = (data: AddMemberFormValues) => {
    if (!data.user_id) return;
    addProjectMemberMutation.mutate(
      {
        user_id: data.user_id,
        role: data.role as "PROJECT_VIEWER" | "PROJECT_CONTRIBUTOR" | "PROJECT_ADMIN",
      },
      {
        onSuccess: () => {
          showNotification("Member added successfully");
          addMemberForm.reset({ user_id: "", role: "PROJECT_VIEWER" });
        },
      },
    );
  };

  return (
    <>
      {projectMembersLoading ? (
        <p className="text-muted-foreground">Loading members…</p>
      ) : (
        <>
          <ul className="divide-y">
            {(projectMembers ?? []).map((pm) => {
              const orgMember = members?.find((m) => m.user_id === pm.user_id);
              const label = orgMember?.display_name || orgMember?.email || pm.user_id;
              const isOnlyAdmin =
                pm.role === "PROJECT_ADMIN" &&
                (projectMembers ?? []).filter((m) => m.role === "PROJECT_ADMIN").length <= 1;
              return (
                <ProjectMemberRow
                  key={pm.id}
                  pm={pm}
                  memberLabel={label}
                  isOnlyAdmin={isOnlyAdmin}
                  onUpdateRole={(userId, role) =>
                    updateProjectMemberMutation.mutate(
                      { userId, role },
                      { onSuccess: () => showNotification("Role updated successfully") },
                    )
                  }
                  isUpdating={updateProjectMemberMutation.isPending}
                  onRemove={(userId) =>
                    removeProjectMemberMutation.mutate(userId, {
                      onSuccess: () => showNotification("Member removed successfully"),
                      onError: (error: Error) => {
                        const body = (error as unknown as { body?: { detail?: string } })?.body;
                        showNotification(body?.detail ?? "Failed to remove member.", "error");
                      },
                    })
                  }
                  isRemoving={removeProjectMemberMutation.isPending}
                />
              );
            })}
            {(projectMembers ?? []).length === 0 && (
              <li className="py-4 text-center text-sm text-muted-foreground">
                No members yet. Add org members below.
              </li>
            )}
          </ul>
          <FormProvider {...addMemberForm}>
            <form
              onSubmit={addMemberForm.handleSubmit(onSubmitAddMember)}
              noValidate
              className="mt-4 flex flex-col gap-4"
            >
              <p className="text-sm font-medium text-muted-foreground">
                Add member
              </p>
              <RhfSelect<AddMemberFormValues>
                name="user_id"
                control={addMemberForm.control}
                label="User"
                placeholder={
                  availableMembersForAdd.length === 0
                    ? "All org members are already in the project"
                    : undefined
                }
                options={
                  availableMembersForAdd.length === 0
                    ? []
                    : availableMembersForAdd.map((m) => ({
                        value: m.user_id,
                        label: (m.display_name || m.email) ?? m.user_id,
                      }))
                }
                selectProps={{ size: "sm" }}
              />
              <RhfSelect<AddMemberFormValues>
                name="role"
                control={addMemberForm.control}
                label="Role"
                options={[
                  { value: "PROJECT_VIEWER", label: "Viewer" },
                  { value: "PROJECT_CONTRIBUTOR", label: "Contributor" },
                  { value: "PROJECT_ADMIN", label: "Admin" },
                ]}
                selectProps={{ size: "sm" }}
              />
              <Button
                type="submit"
                disabled={
                  projectMembersLoading ||
                  addProjectMemberMutation.isPending ||
                  !addMemberForm.watch("user_id") ||
                  availableMembersForAdd.length === 0
                }
              >
                Add member
              </Button>
            </form>
          </FormProvider>
        </>
      )}
      <div className="mt-4 flex justify-end">
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    </>
  );
}
