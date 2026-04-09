import type React from "react";
type UseKeyManagerActionsArgs = {
  selectedKeys: string[];
  importKeysFromHook: (file: File) => Promise<any>;
  testAllKeysFromHook: () => Promise<any>;
  removeBadKeysFromHook: () => Promise<any>;
  deleteSelectedKeysFromHook: (labels: string[]) => Promise<any>;
  clearAllKeysFromHook: () => Promise<any>;
  normalizeKeysFromHook: () => Promise<any>;
  clearLogsFromHook: () => Promise<any>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
};

export function useKeyManagerActions({
  selectedKeys,
  importKeysFromHook,
  testAllKeysFromHook,
  removeBadKeysFromHook,
  deleteSelectedKeysFromHook,
  clearAllKeysFromHook,
  normalizeKeysFromHook,
  clearLogsFromHook,
  fileInputRef
}: UseKeyManagerActionsArgs) {
  async function handleImportKeys(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await importKeysFromHook(file);
      alert(`Đã import thành công. Tổng số key hiện tại: ${data.totalKeys}`);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Import keys thất bại");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleTestAllKeys() {
    try {
      const data = await testAllKeysFromHook();
      alert(`Đã test xong ${data.total} key.`);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Test keys thất bại");
    }
  }

  async function handleRemoveBadKeys() {
    if (!window.confirm("Xóa các key hỏng khỏi danh sách?")) return;

    try {
      const data = await removeBadKeysFromHook();
      const removed = Array.isArray(data?.removed) ? data.removed : [];
      alert(
        removed.length
          ? `Đã xóa ${removed.length} key hỏng:\n${removed.join("\n")}`
          : "Không có key hỏng để xóa."
      );
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Xóa key hỏng thất bại");
    }
  }

  async function handleDeleteSelectedKeys() {
    if (!selectedKeys.length) {
      alert("Chưa chọn key để xóa.");
      return;
    }

    if (!window.confirm(`Xóa ${selectedKeys.length} key đã chọn?`)) return;

    try {
      const countToDelete = selectedKeys.length;
      await deleteSelectedKeysFromHook(selectedKeys);
      alert(`Đã xóa ${countToDelete} key đã chọn.`);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Xóa key đã chọn thất bại");
    }
  }

  async function handleClearAllKeys() {
    if (!window.confirm("Xóa toàn bộ key hiện tại?")) return;

    try {
      await clearAllKeysFromHook();
      alert("Đã xóa toàn bộ key.");
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Xóa toàn bộ key thất bại");
    }
  }

  async function handleNormalizeKeys() {
    if (!window.confirm("Chuẩn hóa key: sort + rename + remove duplicate?")) return;

    try {
      const data = await normalizeKeysFromHook();
      alert(`Đã chuẩn hóa xong. Tổng key còn lại: ${data.totalKeys}`);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Chuẩn hóa key thất bại");
    }
  }

  async function handleClearLogs() {
    if (!window.confirm("Xóa toàn bộ log realtime?")) return;

    try {
      await clearLogsFromHook();
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Clear log thất bại");
    }
  }

  return {
    handleImportKeys,
    handleTestAllKeys,
    handleRemoveBadKeys,
    handleDeleteSelectedKeys,
    handleClearAllKeys,
    handleNormalizeKeys,
    handleClearLogs
  };
}
