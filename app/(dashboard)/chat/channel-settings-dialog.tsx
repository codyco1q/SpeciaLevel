"use client";

import { useEffect, useState, useTransition } from "react";
import {
  AlertTriangle,
  Check,
  Globe,
  Hash,
  LoaderCircle,
  Lock,
  Search,
  Settings,
  Trash2,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  updateChannel,
  deleteChannel,
  getChannelMembers,
  updateChannelMembers,
  type ChatChannelRow,
  type ChatPerson,
} from "@/lib/actions/chat";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

interface ChannelSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: ChatChannelRow | null;
  canManage: boolean;
  currentUserId: string;
  orgMembers: ChatPerson[];
  onUpdated: (channel: ChatChannelRow) => void;
  onDeleted: (channelId: string) => void;
  platform: Dictionary["platform"];
}

export function ChannelSettingsDialog({
  open,
  onOpenChange,
  channel,
  canManage,
  currentUserId,
  orgMembers,
  onUpdated,
  onDeleted,
  platform,
}: ChannelSettingsDialogProps) {
  if (!channel) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <ChannelSettingsContent
          key={channel.id}
          channel={channel}
          canManage={canManage}
          currentUserId={currentUserId}
          orgMembers={orgMembers}
          onUpdated={onUpdated}
          onDeleted={onDeleted}
          onClose={() => onOpenChange(false)}
          platform={platform}
        />
      )}
    </Dialog>
  );
}

interface ChannelSettingsContentProps {
  channel: ChatChannelRow;
  canManage: boolean;
  currentUserId: string;
  orgMembers: ChatPerson[];
  onUpdated: (channel: ChatChannelRow) => void;
  onDeleted: (channelId: string) => void;
  onClose: () => void;
  platform: Dictionary["platform"];
}

function ChannelSettingsContent({
  channel,
  canManage,
  currentUserId,
  orgMembers,
  onUpdated,
  onDeleted,
  onClose,
  platform,
}: ChannelSettingsContentProps) {
  const t = platform.chat;
  const s = t.settings;

  const [tab, setTab] = useState<"general" | "members" | "danger">("general");

  // General tab state
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description ?? "");
  const [isPrivate, setIsPrivate] = useState(channel.isPrivate);
  const [generalPending, startGeneralTransition] = useTransition();
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [generalSuccess, setGeneralSuccess] = useState(false);

  // Members tab state
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(
    () =>
      channel.isPrivate
        ? new Set<string>()
        : new Set<string>(orgMembers.map((m) => m.id))
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [membersLoading, setMembersLoading] = useState(channel.isPrivate);
  const [membersPending, startMembersTransition] = useTransition();
  const [membersError, setMembersError] = useState<string | null>(null);
  const [membersSuccess, setMembersSuccess] = useState(false);

  // Danger tab state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePending, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Fetch initial channel members for private channels
  useEffect(() => {
    if (!channel.isPrivate) return;

    let isSubscribed = true;
    void getChannelMembers(channel.id)
      .then((res) => {
        if (isSubscribed && res.status === "success") {
          setSelectedMemberIds(new Set(res.members.map((m) => m.userId)));
        }
      })
      .finally(() => {
        if (isSubscribed) {
          setMembersLoading(false);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [channel.id, channel.isPrivate]);

  const isSystem = channel.isSystem;
  const isCreator = channel.createdBy === currentUserId;
  const canEdit = canManage || isCreator;

  function handleSaveGeneral(e: React.FormEvent) {
    e.preventDefault();
    if (!channel) return;

    setGeneralError(null);
    setGeneralSuccess(false);

    startGeneralTransition(async () => {
      const result = await updateChannel(channel.id, {
        name: isSystem && channel.name === "general" ? undefined : name,
        description,
        isPrivate: isSystem ? false : isPrivate,
      });

      if (result.status === "error") {
        setGeneralError(result.error ?? t.errors.createFailed);
      } else {
        setGeneralSuccess(true);
        onUpdated(result.channel);
        setTimeout(() => setGeneralSuccess(false), 2500);
      }
    });
  }

  function handleToggleMember(userId: string) {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  function handleSaveMembers() {
    if (!channel) return;

    setMembersError(null);
    setMembersSuccess(false);

    startMembersTransition(async () => {
      const result = await updateChannelMembers(
        channel.id,
        Array.from(selectedMemberIds)
      );

      if (result.status === "error") {
        setMembersError(result.error ?? t.errors.createFailed);
      } else {
        setMembersSuccess(true);
        setTimeout(() => setMembersSuccess(false), 2500);
      }
    });
  }

  function handleDeleteChannel() {
    if (isSystem) return;

    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteChannel(channel.id);
      if (result.status === "error") {
        setDeleteError(result.error ?? t.errors.createFailed);
      } else {
        onDeleted(channel.id);
        onClose();
      }
    });
  }

  const filteredMembers = orgMembers.filter((m) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    const nameMatch = m.fullName?.toLowerCase().includes(query) ?? false;
    const emailMatch = m.email?.toLowerCase().includes(query) ?? false;
    return nameMatch || emailMatch;
  });

  return (
    <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
      <DialogHeader className="p-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                {s?.channelSettings ?? "Channel Settings"}
                <span className="font-mono text-muted-foreground ml-2 text-sm font-normal">
                  #{channel.name}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {s?.channelSettingsDescription ??
                  "Manage channel details, privacy, and member access."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(val) =>
            setTab(val as "general" | "members" | "danger")
          }
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="px-6 pt-3 shrink-0 border-b border-border bg-muted/20">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="general" className="text-xs">
                {s?.tabGeneral ?? "General"}
              </TabsTrigger>
              <TabsTrigger value="members" className="text-xs gap-1.5">
                {s?.tabMembers ?? "Members"}
                {channel.isPrivate && (
                  <Badge
                    variant="secondary"
                    className="px-1 py-0 text-[10px] h-4"
                  >
                    {selectedMemberIds.size}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="danger"
                className="text-xs text-destructive data-[state=active]:text-destructive"
              >
                {s?.tabDanger ?? "Danger Zone"}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {/* 1. GENERAL TAB */}
            <TabsContent value="general" className="mt-0 space-y-4">
              <form onSubmit={handleSaveGeneral} className="space-y-4">
                {generalError && (
                  <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{generalError}</span>
                  </div>
                )}
                {generalSuccess && (
                  <div className="rounded-md bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0" />
                    <span>
                      {s?.channelUpdated ?? "Channel updated successfully."}
                    </span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="channel-name" className="text-xs font-medium">
                    {s?.channelName ?? t.channelName}
                  </Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground rtl:left-auto rtl:right-3" />
                    <Input
                      id="channel-name"
                      value={name}
                      onChange={(e) =>
                        setName(
                          e.target.value.toLowerCase().replace(/\s+/g, "-")
                        )
                      }
                      disabled={
                        !canEdit || (isSystem && channel.name === "general")
                      }
                      placeholder={
                        s?.channelNamePlaceholder ?? t.channelNamePlaceholder
                      }
                      className="pl-8 rtl:pl-3 rtl:pr-8 font-mono text-sm"
                    />
                  </div>
                  {isSystem && channel.name === "general" && (
                    <p className="text-[11px] text-muted-foreground">
                      {s?.systemChannelNotice ??
                        "This is a system default channel and cannot be renamed."}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="channel-desc" className="text-xs font-medium">
                    {s?.channelDescription ?? t.descriptionField}
                  </Label>
                  <Textarea
                    id="channel-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={!canEdit}
                    placeholder={
                      s?.channelDescriptionPlaceholder ??
                      t.descriptionPlaceholder
                    }
                    rows={3}
                    className="text-sm resize-none"
                  />
                </div>

                <div className="space-y-2 pt-1">
                  <Label className="text-xs font-medium">
                    {s?.privacy ?? "Privacy"}
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={!canEdit || isSystem}
                      onClick={() => setIsPrivate(false)}
                      className={`flex items-start gap-3 p-3 rounded-lg border text-left rtl:text-right transition-all ${
                        !isPrivate
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:bg-muted/50"
                      } ${!canEdit || isSystem ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      <Globe className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold">
                          {s?.privacyPublic ?? "Public"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {s?.privacyPublicDesc ??
                            "Anyone in the workspace can view and join this channel."}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={!canEdit || isSystem}
                      onClick={() => setIsPrivate(true)}
                      className={`flex items-start gap-3 p-3 rounded-lg border text-left rtl:text-right transition-all ${
                        isPrivate
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:bg-muted/50"
                      } ${!canEdit || isSystem ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      <Lock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold">
                          {s?.privacyPrivate ?? "Private"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {s?.privacyPrivateDesc ??
                            "Only invited members can view messages in this channel."}
                        </p>
                      </div>
                    </button>
                  </div>
                  {isSystem && (
                    <p className="text-[11px] text-muted-foreground">
                      {s?.systemChannelNotice ??
                        "This is a system default channel. Its privacy cannot be modified."}
                    </p>
                  )}
                </div>

                {canEdit && (
                  <div className="pt-3 flex justify-end">
                    <Button
                      type="submit"
                      disabled={generalPending}
                      size="sm"
                      className="min-w-[120px]"
                    >
                      {generalPending ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        s?.saveChanges ?? "Save Changes"
                      )}
                    </Button>
                  </div>
                )}
              </form>
            </TabsContent>


            {/* 2. MEMBERS TAB */}
            <TabsContent value="members" className="mt-0 space-y-4">
              {!isPrivate ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center space-y-2">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <h4 className="text-sm font-semibold">
                    {s?.privacyPublic ?? "Public Channel"}
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    {s?.publicChannelNotice ??
                      "This channel is public. All team members in your workspace have access automatically."}
                  </p>
                  {canEdit && !isSystem && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsPrivate(true);
                        setTab("general");
                      }}
                      className="mt-2 text-xs"
                    >
                      <Lock className="h-3.5 w-3.5 mr-1.5" />
                      {t.privateChannel}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {membersError && (
                    <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>{membersError}</span>
                    </div>
                  )}
                  {membersSuccess && (
                    <div className="rounded-md bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0" />
                      <span>
                        {s?.membersUpdated ??
                          "Channel members updated successfully."}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground rtl:left-auto rtl:right-3" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={
                          s?.membersSearchPlaceholder ??
                          "Search team members by name or email..."
                        }
                        className="pl-8 rtl:pl-3 rtl:pr-8 text-xs h-9"
                      />
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {s?.selectedMembersCount
                        ? s.selectedMembersCount
                            .replace("{count}", String(selectedMemberIds.size))
                            .replace(
                              "{s}",
                              selectedMemberIds.size === 1 ? "" : "s"
                            )
                        : `${selectedMemberIds.size} members`}
                    </Badge>
                  </div>

                  {membersLoading ? (
                    <div className="flex py-12 items-center justify-center">
                      <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredMembers.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      {s?.noMembersFound ??
                        "No members found matching your search."}
                    </div>
                  ) : (
                    <ScrollArea className="h-60 rounded-md border border-border">
                      <div className="divide-y divide-border">
                        {filteredMembers.map((member) => {
                          const isSelected = selectedMemberIds.has(member.id);
                          const isChannelCreator =
                            member.id === channel.createdBy;
                          const isCurrent = member.id === currentUserId;

                          return (
                            <div
                              key={member.id}
                              onClick={() => {
                                if (canEdit && !isChannelCreator) {
                                  handleToggleMember(member.id);
                                }
                              }}
                              className={`flex items-center justify-between p-3 transition-colors ${
                                canEdit && !isChannelCreator
                                  ? "cursor-pointer hover:bg-muted/40"
                                  : "opacity-80"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <Checkbox
                                  checked={isSelected || isChannelCreator}
                                  disabled={!canEdit || isChannelCreator}
                                  onCheckedChange={() =>
                                    handleToggleMember(member.id)
                                  }
                                  aria-label={
                                    member.fullName ??
                                    member.email ??
                                    "Member"
                                  }
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs font-medium truncate">
                                      {member.fullName || member.email}
                                    </p>
                                    {isCurrent && (
                                      <Badge
                                        variant="secondary"
                                        className="px-1 py-0 text-[10px] h-4"
                                      >
                                        You
                                      </Badge>
                                    )}
                                    {isChannelCreator && (
                                      <Badge
                                        variant="outline"
                                        className="px-1 py-0 text-[10px] h-4"
                                      >
                                        Creator
                                      </Badge>
                                    )}
                                  </div>
                                  {member.fullName && member.email && (
                                    <p className="text-[11px] text-muted-foreground truncate">
                                      {member.email}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}

                  {canEdit && (
                    <div className="pt-2 flex justify-end">
                      <Button
                        type="button"
                        onClick={handleSaveMembers}
                        disabled={membersPending || membersLoading}
                        size="sm"
                        className="min-w-[120px]"
                      >
                        {membersPending ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          s?.saveMembers ?? "Save Members"
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>


            {/* 3. DANGER ZONE */}
            <TabsContent value="danger" className="mt-0 space-y-4">
              {deleteError && (
                <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Trash2 className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-destructive">
                      {s?.deleteChannelTitle ?? "Delete Channel"}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {s?.deleteChannelDescription ??
                        "Permanently remove this channel and all associated chat messages and files."}
                    </p>
                  </div>
                </div>

                {isSystem ? (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground italic">
                      {s?.systemChannelCannotDelete ??
                        "System default channels cannot be deleted."}
                    </p>
                  </div>
                ) : !canEdit ? (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground italic">
                      {t.errors.noPermissionManage}
                    </p>
                  </div>
                ) : confirmDelete ? (
                  <div className="pt-3 border-t border-destructive/20 space-y-3">
                    <p className="text-xs font-medium text-destructive">
                      {s?.deleteChannelConfirmBody ??
                        "Are you sure you want to delete this channel? All messages and attachments will be permanently deleted. This action cannot be undone."}
                    </p>
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={deletePending}
                        onClick={() => setConfirmDelete(false)}
                        className="text-xs"
                      >
                        {s?.cancel ?? "Cancel"}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={deletePending}
                        onClick={handleDeleteChannel}
                        className="text-xs min-w-[120px]"
                      >
                        {deletePending ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          s?.confirmDelete ?? "Yes, delete channel"
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 flex justify-end">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setConfirmDelete(true)}
                      className="text-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5 rtl:ml-1.5 rtl:mr-0" />
                      {s?.deleteChannel ?? "Delete Channel"}
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
  );
}

