import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import {
  FileText,
  RefreshCw,
  Search,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ShieldCheck,
  X,
} from "lucide-react";
import api from "../../services/api";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
];

const statusStyles = {
  pending: "bg-amber-100 text-amber-800",
  verified: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

function DocumentVerificationPage() {
  const { user } = useSelector((state) => state.auth);
  const permissions = user?.role?.permissions || [];

  const canVerify =
    permissions.includes("*") || permissions.includes("documents.verify");

  const [documents, setDocuments] = useState([]);
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  const [selectedDocument, setSelectedDocument] = useState(null);
  const [reviewAction, setReviewAction] = useState("");
  const [remarks, setRemarks] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [downloadingId, setDownloadingId] = useState("");

  const loadDocuments = useCallback(async () => {
    if (!canVerify) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await api.get("/documents/verification", {
        params: {
          status,
          page: 1,
          limit: 100,
        },
      });

      setDocuments(response.data.data?.documents || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load document verification queue.",
      );
    } finally {
      setLoading(false);
    }
  }, [status, canVerify]);

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

  const handleOpenDocument = async (documentId) => {
    try {
      setDownloadingId(documentId);
      setError("");

      const response = await api.get(`/documents/${documentId}/file`, {
        params: { download: false },
      });

      const fileUrl = response.data.data?.url;

      if (!fileUrl) {
        throw new Error("Secure document link was not returned.");
      }

      window.open(fileUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to open document.",
      );
    } finally {
      setDownloadingId("");
    }
  };

  const openReview = (document, action) => {
    setSelectedDocument(document);
    setReviewAction(action);
    setRemarks("");
    setError("");
    setSuccess("");
  };

  const closeReview = () => {
    if (reviewing) return;

    setSelectedDocument(null);
    setReviewAction("");
    setRemarks("");
  };

  const handleReview = async (event) => {
    event.preventDefault();

    if (!selectedDocument || !reviewAction) return;

    if (reviewAction === "reject" && !remarks.trim()) {
      setError("Remarks are required when rejecting a document.");
      return;
    }

    try {
      setReviewing(true);
      setError("");
      setSuccess("");

      await api.patch(`/documents/${selectedDocument._id}/review`, {
        action: reviewAction,
        remarks: remarks.trim(),
      });

      setSuccess(
        reviewAction === "verify"
          ? "Document verified successfully."
          : "Document rejected successfully.",
      );

      setSelectedDocument(null);
      setReviewAction("");
      setRemarks("");

      await loadDocuments();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to update document verification status.",
      );
    } finally {
      setReviewing(false);
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    const employeeName = [doc.employee?.firstName, doc.employee?.lastName]
      .filter(Boolean)
      .join(" ");

    const searchText = [
      doc.documentName,
      doc.documentType,
      employeeName,
      doc.employee?.employeeCode,
      doc.file?.originalName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchText.includes(search.toLowerCase().trim());
  });

  if (!canVerify) {
    return (
      <main className="p-6">
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
          You do not have permission to verify employee documents.
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-green-700">
            Chandra Enterprises / HR
          </p>

          <h1 className="text-2xl font-bold text-gray-900">
            Document Verification
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Review and verify employee identity and other documents.
          </p>
        </div>

        <button
          type="button"
          onClick={loadDocuments}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          {success}
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatus(option.value)}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                  status === option.value
                    ? "bg-[#17613b] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:max-w-sm">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employee or document..."
              className="w-full rounded-lg border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-green-700"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">
              {status.charAt(0).toUpperCase() + status.slice(1)} Documents
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              {filteredDocuments.length} document(s) displayed
            </p>
          </div>

          <div className="rounded-xl bg-green-50 p-3 text-green-800">
            <ShieldCheck size={22} />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-12 text-sm text-gray-500">
            <RefreshCw size={19} className="animate-spin" />
            Loading verification queue...
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center">
            <FileText size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="font-semibold text-gray-700">
              No {status} documents found
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Documents matching this filter will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDocuments.map((doc) => {
              const employeeName = [
                doc.employee?.firstName,
                doc.employee?.lastName,
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <article
                  key={doc._id}
                  className="rounded-xl border border-gray-100 p-4 transition hover:border-green-200 sm:p-5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="rounded-xl bg-green-50 p-3 text-green-800">
                        <FileText size={22} />
                      </div>

                      <div className="min-w-0">
                        <h3 className="wrap-break-word font-semibold text-gray-900">
                          {doc.documentName ||
                            doc.file?.originalName ||
                            "Employee Document"}
                        </h3>

                        <p className="mt-1 text-sm capitalize text-gray-600">
                          {doc.documentType?.replaceAll("_", " ")}
                        </p>

                        <p className="mt-2 text-sm font-medium text-gray-800">
                          {employeeName || "Employee name unavailable"}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          Employee ID:{" "}
                          {doc.employee?.employeeCode || "Not available"}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          Uploaded:{" "}
                          {doc.createdAt
                            ? new Date(doc.createdAt).toLocaleDateString(
                                "en-IN",
                              )
                            : "Not available"}
                        </p>

                        {doc.documentNumberMasked && (
                          <p className="mt-1 text-xs text-gray-500">
                            Masked number: {doc.documentNumberMasked}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
                          statusStyles[doc.verificationStatus] ||
                          "bg-gray-100 text-gray-700"
                        }`}
                      >
                        <Clock size={13} />
                        {doc.verificationStatus}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleOpenDocument(doc._id)}
                        disabled={downloadingId === doc._id}
                        className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {downloadingId === doc._id ? (
                          <RefreshCw size={16} className="animate-spin" />
                        ) : (
                          <Download size={16} />
                        )}
                        Open
                      </button>

                      {status === "pending" && (
                        <>
                          <button
                            type="button"
                            onClick={() => openReview(doc, "verify")}
                            className="flex items-center gap-2 rounded-lg bg-green-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-green-800"
                          >
                            <CheckCircle2 size={16} />
                            Verify
                          </button>

                          <button
                            type="button"
                            onClick={() => openReview(doc, "reject")}
                            className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100"
                          >
                            <XCircle size={16} />
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {doc.verificationRemarks && (
                    <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                      <strong>HR remarks:</strong> {doc.verificationRemarks}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {selectedDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-auto w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {reviewAction === "verify"
                    ? "Verify Document"
                    : "Reject Document"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedDocument.documentName}
                </p>
              </div>

              <button
                type="button"
                onClick={closeReview}
                disabled={reviewing}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                aria-label="Close review dialog"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleReview}>
              <label className="block text-sm font-semibold text-gray-700">
                HR Remarks {reviewAction === "reject" ? "*" : "(Optional)"}
                <textarea
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  rows={4}
                  maxLength={1000}
                  required={reviewAction === "reject"}
                  placeholder={
                    reviewAction === "reject"
                      ? "Explain why this document is being rejected..."
                      : "Add verification remarks if required..."
                  }
                  className="mt-2 w-full rounded-lg border border-gray-200 p-3 text-sm outline-none focus:border-green-700"
                />
              </label>

              <p className="mt-1 text-right text-xs text-gray-400">
                {remarks.length}/1000 characters
              </p>

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={closeReview}
                  disabled={reviewing}
                  className="rounded-lg border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    reviewing || (reviewAction === "reject" && !remarks.trim())
                  }
                  className={`flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                    reviewAction === "verify"
                      ? "bg-green-700 hover:bg-green-800"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {reviewing && (
                    <RefreshCw size={16} className="animate-spin" />
                  )}
                  {reviewing
                    ? "Submitting..."
                    : reviewAction === "verify"
                      ? "Confirm Verification"
                      : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default DocumentVerificationPage;
