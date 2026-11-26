import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import {
  FileText,
  Upload,
  Download,
  RefreshCw,
  ShieldCheck,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
  X,
} from "lucide-react";
import api from "../../services/api";

const DOCUMENT_TYPES = [
  { value: "aadhaar", label: "Aadhaar Card" },
  { value: "pan", label: "PAN Card" },
  { value: "voter_id", label: "Voter ID" },
  { value: "passport", label: "Passport" },
  { value: "driving_license", label: "Driving Licence" },
  { value: "bank_proof", label: "Bank Proof" },
  { value: "education_certificate", label: "Education Certificate" },
  { value: "experience_letter", label: "Experience Letter" },
  { value: "address_proof", label: "Address Proof" },
  { value: "other", label: "Other" },
];

const initialForm = {
  documentType: "aadhaar",
  documentName: "",
  documentNumberMasked: "",
  issueDate: "",
  expiryDate: "",
};

const statusStyles = {
  pending: "bg-amber-100 text-amber-800",
  verified: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

function EmployeeDocumentsSection({ employeeId }) {
  const { user } = useSelector((state) => state.auth);

  const permissions = user?.role?.permissions || [];
  const hasPermission = (permission) =>
    permissions.includes("*") || permissions.includes(permission);

  const canView = hasPermission("documents.view");
  const canUpload = hasPermission("documents.upload");

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [downloadingId, setDownloadingId] = useState("");

  // Document preview state
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadDocuments = useCallback(async () => {
    if (!employeeId || !canView) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await api.get(`/documents/employee/${employeeId}`);

      setDocuments(response.data.data?.documents || []);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to load employee documents.",
      );
    } finally {
      setLoading(false);
    }
  }, [employeeId, canView]);

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (!cancelled) {
        void loadDocuments();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadDocuments]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleUpload = async (event) => {
    event.preventDefault();

    if (!selectedFile) {
      setError("Please select a document file.");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("File size must not exceed 10 MB.");
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(selectedFile.type)) {
      setError("Only PDF, JPG, PNG and WEBP files are allowed.");
      return;
    }

    try {
      setUploading(true);
      setError("");
      setSuccess("");

      const formData = new FormData();

      formData.append("document", selectedFile);
      formData.append("documentType", form.documentType);
      formData.append(
        "documentName",
        form.documentName.trim() || selectedFile.name,
      );

      if (form.documentNumberMasked.trim()) {
        formData.append(
          "documentNumberMasked",
          form.documentNumberMasked.trim(),
        );
      }

      if (form.issueDate) {
        formData.append("issueDate", form.issueDate);
      }

      if (form.expiryDate) {
        formData.append("expiryDate", form.expiryDate);
      }

      await api.post(`/documents/${employeeId}/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setSuccess("Document uploaded successfully. Awaiting HR verification.");
      setForm(initialForm);
      setSelectedFile(null);
      setShowForm(false);

      const fileInput = document.getElementById(
        `employee-document-${employeeId}`,
      );

      if (fileInput) fileInput.value = "";

      await loadDocuments();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to upload document.");
    } finally {
      setUploading(false);
    }
  };

  // Secure document preview
  const handlePreview = async (doc) => {
    try {
      setSelectedDocument(doc);
      setPreviewUrl("");
      setPreviewLoading(true);
      setError("");

      const response = await api.get(`/documents/${doc._id}/file`, {
        params: { download: false },
      });

      const fileUrl = response.data.data?.url;

      if (!fileUrl) {
        throw new Error("Secure document preview link was not returned.");
      }

      setPreviewUrl(fileUrl);
    } catch (err) {
      setSelectedDocument(null);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to preview document.",
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  // Secure document download
  const handleDownload = async (documentId) => {
    try {
      setDownloadingId(documentId);
      setError("");

      const response = await api.get(`/documents/${documentId}/file`, {
        params: { download: true },
      });

      const fileUrl = response.data.data?.url;

      if (!fileUrl) {
        throw new Error("Secure document download link was not returned.");
      }

      window.open(fileUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to access document.",
      );
    } finally {
      setDownloadingId("");
    }
  };

  const closePreview = () => {
    setSelectedDocument(null);
    setPreviewUrl("");
    setPreviewLoading(false);
  };

  // Permission check
  if (!canView) {
    return (
      <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 text-gray-500">
          <ShieldCheck size={21} />
          <p className="text-sm">
            You do not have permission to view employee documents.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-green-100 p-3 text-green-800">
            <FileText size={23} />
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">Employee Documents</h3>
            <p className="mt-1 text-sm text-gray-500">
              Secure employee records and verification status
            </p>
          </div>
        </div>

        {canUpload && (
          <button
            type="button"
            onClick={() => {
              setError("");
              setSuccess("");
              setShowForm((previous) => !previous);
            }}
            className="flex items-center gap-2 rounded-lg bg-[#17613b] px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-800"
          >
            <Upload size={17} />
            {showForm ? "Cancel Upload" : "Upload Document"}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          {success}
        </div>
      )}

      {/* Upload Form */}
      {showForm && canUpload && (
        <form
          onSubmit={handleUpload}
          className="mb-7 rounded-xl border border-green-100 bg-green-50/50 p-5"
        >
          <h4 className="mb-5 font-semibold text-gray-900">
            Upload Employee Document
          </h4>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="text-sm font-semibold text-gray-700">
              Document Type *
              <select
                name="documentType"
                value={form.documentType}
                onChange={handleFormChange}
                required
                className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-green-700"
              >
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold text-gray-700">
              Document Name
              <input
                name="documentName"
                value={form.documentName}
                onChange={handleFormChange}
                maxLength={120}
                placeholder="e.g. Aadhaar Card Front"
                className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-green-700"
              />
            </label>

            <label className="text-sm font-semibold text-gray-700">
              Masked Document Number
              <input
                name="documentNumberMasked"
                value={form.documentNumberMasked}
                onChange={handleFormChange}
                maxLength={32}
                placeholder="Only enter a masked number"
                className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-green-700"
              />
              <span className="mt-1 block text-xs font-normal text-gray-500">
                Never enter a complete Aadhaar or PAN number.
              </span>
            </label>

            <label className="text-sm font-semibold text-gray-700">
              Document File *
              <input
                id={`employee-document-${employeeId}`}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                required
                onChange={(event) =>
                  setSelectedFile(event.target.files?.[0] || null)
                }
                className="mt-2 block w-full rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm"
              />
              <span className="mt-1 block text-xs font-normal text-gray-500">
                PDF, JPG, PNG or WEBP. Maximum 10 MB.
              </span>
            </label>

            <label className="text-sm font-semibold text-gray-700">
              Issue Date
              <input
                name="issueDate"
                type="date"
                value={form.issueDate}
                onChange={handleFormChange}
                className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm"
              />
            </label>

            <label className="text-sm font-semibold text-gray-700">
              Expiry Date
              <input
                name="expiryDate"
                type="date"
                value={form.expiryDate}
                onChange={handleFormChange}
                min={form.issueDate || undefined}
                className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm"
              />
            </label>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="flex items-center gap-2 rounded-lg bg-[#17613b] px-6 py-3 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? (
                <RefreshCw size={17} className="animate-spin" />
              ) : (
                <Upload size={17} />
              )}
              {uploading ? "Uploading..." : "Submit Document"}
            </button>
          </div>
        </form>
      )}

      {/* Uploaded Documents */}
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800">
          Uploaded Documents ({documents.length})
        </h4>

        <button
          type="button"
          onClick={loadDocuments}
          disabled={loading}
          className="flex items-center gap-2 text-sm font-medium text-green-700 hover:text-green-900 disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-10 text-sm text-gray-500">
          <RefreshCw size={18} className="animate-spin" />
          Loading documents...
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-5 py-10 text-center">
          <FileText size={34} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-700">No documents uploaded yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Employee documents will appear here after upload.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc._id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-100 p-4 transition hover:border-green-200"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="rounded-lg bg-gray-100 p-3 text-gray-600">
                  <FileText size={21} />
                </div>

                <div className="min-w-0">
                  <p className="wrap-break-word text-sm font-semibold text-gray-900">
                    {doc.documentName || doc.file?.originalName || "Document"}
                  </p>

                  <p className="mt-1 text-xs capitalize text-gray-500">
                    {doc.documentType?.replaceAll("_", " ")}
                    {doc.documentNumberMasked
                      ? ` • ${doc.documentNumberMasked}`
                      : ""}
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    Uploaded:{" "}
                    {doc.createdAt
                      ? new Date(doc.createdAt).toLocaleDateString("en-IN")
                      : "Date unavailable"}
                  </p>

                  {doc.verificationRemarks && (
                    <p className="mt-2 text-xs text-gray-600">
                      HR remarks: {doc.verificationRemarks}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
                    statusStyles[doc.verificationStatus] ||
                    "bg-gray-100 text-gray-700"
                  }`}
                >
                  {doc.verificationStatus === "verified" ? (
                    <CheckCircle2 size={13} />
                  ) : doc.verificationStatus === "rejected" ? (
                    <XCircle size={13} />
                  ) : (
                    <Clock size={13} />
                  )}
                  {doc.verificationStatus || "Unknown"}
                </span>

                {/* Preview Button */}
                <button
                  type="button"
                  onClick={() => handlePreview(doc)}
                  title="View document and information"
                  className="rounded-lg border border-green-200 bg-green-50 p-2.5 text-green-700 transition hover:bg-green-100"
                >
                  <Eye size={17} />
                </button>

                {/* Download Button */}
                <button
                  type="button"
                  onClick={() => handleDownload(doc._id)}
                  disabled={downloadingId === doc._id}
                  title="Secure document download"
                  className="rounded-lg border border-gray-200 p-2.5 text-gray-600 transition hover:border-green-300 hover:bg-green-50 hover:text-green-800 disabled:opacity-50"
                >
                  {downloadingId === doc._id ? (
                    <RefreshCw size={17} className="animate-spin" />
                  ) : (
                    <Download size={17} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Document Preview Modal */}
      {selectedDocument && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 p-3 sm:p-6"
          onClick={closePreview}
        >
          <div
            className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-gray-900">
                  {selectedDocument.documentName ||
                    selectedDocument.file?.originalName ||
                    "Document Preview"}
                </h3>
                <p className="text-xs text-gray-500">
                  Secure employee document viewer
                </p>
              </div>

              <button
                type="button"
                onClick={closePreview}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                title="Close preview"
              >
                <X size={22} />
              </button>
            </div>

            {/* Preview and Information */}
            <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1fr_320px]">
              {/* File Preview */}
              <div className="flex min-h-87.5 items-center justify-center bg-gray-100 p-3 sm:p-5">
                {previewLoading ? (
                  <div className="flex items-center gap-3 text-gray-500">
                    <RefreshCw size={20} className="animate-spin" />
                    Loading secure preview...
                  </div>
                ) : previewUrl ? (
                  selectedDocument.file?.mimeType === "application/pdf" ||
                  selectedDocument.file?.format === "pdf" ? (
                    <iframe
                      src={previewUrl}
                      title="Employee document PDF preview"
                      className="h-[65vh] w-full rounded-lg border border-gray-200 bg-white"
                    />
                  ) : selectedDocument.file?.mimeType?.startsWith("image/") ? (
                    <img
                      src={previewUrl}
                      alt={selectedDocument.documentName || "Employee document"}
                      className="max-h-[70vh] max-w-full rounded-lg object-contain shadow"
                    />
                  ) : (
                    <p className="text-center text-sm text-gray-600">
                      Preview is unavailable for this file type. Please download
                      the document.
                    </p>
                  )
                ) : (
                  <p className="text-sm text-gray-500">
                    Unable to load document preview.
                  </p>
                )}
              </div>

              {/* Document Information */}
              <aside className="space-y-5 border-t border-gray-200 bg-white p-5 lg:border-l lg:border-t-0">
                <h4 className="font-semibold text-gray-900">
                  Document Information
                </h4>

                <div>
                  <p className="text-xs text-gray-500">Document Name</p>
                  <p className="mt-1 wrap-break-word text-sm font-medium text-gray-800">
                    {selectedDocument.documentName || "Not available"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Document Type</p>
                  <p className="mt-1 text-sm font-medium capitalize text-gray-800">
                    {selectedDocument.documentType?.replaceAll("_", " ") ||
                      "Not available"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Original File</p>
                  <p className="mt-1 break-all text-sm text-gray-800">
                    {selectedDocument.file?.originalName || "Not available"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Uploaded Date</p>
                  <p className="mt-1 text-sm text-gray-800">
                    {selectedDocument.createdAt
                      ? new Date(selectedDocument.createdAt).toLocaleDateString(
                          "en-IN",
                        )
                      : "Not available"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">
                    Masked Document Number
                  </p>
                  <p className="mt-1 text-sm text-gray-800">
                    {selectedDocument.documentNumberMasked || "Not provided"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Issue Date</p>
                  <p className="mt-1 text-sm text-gray-800">
                    {selectedDocument.issueDate
                      ? new Date(selectedDocument.issueDate).toLocaleDateString(
                          "en-IN",
                        )
                      : "Not provided"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Expiry Date</p>
                  <p className="mt-1 text-sm text-gray-800">
                    {selectedDocument.expiryDate
                      ? new Date(
                          selectedDocument.expiryDate,
                        ).toLocaleDateString("en-IN")
                      : "Not provided"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Verification Status</p>
                  <span
                    className={`mt-2 inline-flex rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
                      statusStyles[selectedDocument.verificationStatus] ||
                      "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {selectedDocument.verificationStatus || "Unknown"}
                  </span>
                </div>

                {selectedDocument.verificationRemarks && (
                  <div>
                    <p className="text-xs text-gray-500">HR Remarks</p>
                    <p className="mt-1 wrap-break-word text-sm text-gray-800">
                      {selectedDocument.verificationRemarks}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleDownload(selectedDocument._id)}
                  disabled={downloadingId === selectedDocument._id}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#17613b] px-4 py-3 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
                >
                  {downloadingId === selectedDocument._id ? (
                    <RefreshCw size={17} className="animate-spin" />
                  ) : (
                    <Download size={17} />
                  )}
                  Download Document
                </button>
              </aside>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default EmployeeDocumentsSection;
