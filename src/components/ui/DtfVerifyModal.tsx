'use client'

import { useState } from 'react'
import { X, Upload, CheckCircle, Clock } from 'lucide-react'
import type { VerificationStatus } from '@/types'

interface Props {
  onClose: () => void
  currentStatus: VerificationStatus | null
}

export default function DtfVerifyModal({ onClose, currentStatus }: Props) {
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    if (files.length + selected.length > 5) {
      setError('파일은 최대 5개까지 첨부 가능합니다.')
      return
    }
    setError('')
    setFiles((prev) => [...prev, ...selected])
  }

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (files.length === 0) {
      setError('장비 사진 또는 계약서를 1개 이상 첨부해주세요.')
      return
    }
    setLoading(true)
    // TODO: Supabase 연동 후 실제 파일 업로드 및 인증 요청 저장
    await new Promise((r) => setTimeout(r, 1000))
    setLoading(false)
    setSubmitted(true)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">DTF 장비 보유 인증</h2>
            <p className="text-sm text-gray-500 mt-0.5">인증 완료 시 전용 특가 상품이 제공됩니다</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* 이미 신청 중인 경우 */}
          {currentStatus === 'pending' && !submitted && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
              <h3 className="font-bold text-gray-800 mb-2">심사 중입니다</h3>
              <p className="text-sm text-gray-500">
                인증 신청이 접수되어 관리자 확인 중입니다.<br />
                승인 완료 시 이메일로 안내드립니다.
              </p>
            </div>
          )}

          {/* 승인된 경우 */}
          {currentStatus === 'approved' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="font-bold text-gray-800 mb-2">인증 완료</h3>
              <p className="text-sm text-gray-500">
                DTF 장비 보유 인증이 완료되었습니다.<br />
                인증 전용 상품을 이용하실 수 있습니다.
              </p>
            </div>
          )}

          {/* 제출 완료 */}
          {submitted && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="font-bold text-gray-800 mb-2">신청이 접수되었습니다</h3>
              <p className="text-sm text-gray-500">
                관리자 확인 후 승인 처리됩니다.<br />
                승인 완료 시 이메일로 안내드립니다.
              </p>
            </div>
          )}

          {/* 신청 폼 */}
          {!currentStatus && !submitted && (
            <form onSubmit={handleSubmit}>
              {/* 안내 */}
              <div className="bg-blue-50 rounded-xl p-4 mb-5 text-sm text-blue-700">
                <p className="font-semibold mb-1">제출 서류 안내</p>
                <ul className="space-y-1 text-blue-600 list-disc list-inside">
                  <li>DTF 장비 사진 (장비 전체가 보이는 사진)</li>
                  <li>사업자 등록증</li>
                </ul>
              </div>

              {/* 파일 업로드 */}
              <div className="mb-4">
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                  파일 첨부 <span className="text-red-500">*</span>
                  <span className="text-gray-400 font-normal ml-1">(최대 5개, JPG·PNG·PDF)</span>
                </label>

                {/* 첨부된 파일 목록 */}
                {files.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {files.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                        <span className="text-sm text-gray-700 flex-1 truncate">{file.name}</span>
                        <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)}KB</span>
                        <button type="button" onClick={() => removeFile(idx)} className="text-gray-400 hover:text-red-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {files.length < 5 && (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                    <Upload className="w-7 h-7 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500">클릭하여 파일 선택</span>
                    <input
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.pdf"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                )}
              </div>

              {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? '제출 중...' : '인증 신청하기'}
              </button>
            </form>
          )}

          {/* 거절된 경우 - 재신청 가능 */}
          {currentStatus === 'rejected' && !submitted && (
            <form onSubmit={handleSubmit}>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 text-sm text-red-600">
                이전 신청이 반려되었습니다. 서류를 보완하여 재신청해주세요.
              </div>

              <div className="mb-4">
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                  파일 첨부 <span className="text-red-500">*</span>
                </label>
                {files.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {files.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                        <span className="text-sm text-gray-700 flex-1 truncate">{file.name}</span>
                        <button type="button" onClick={() => removeFile(idx)} className="text-gray-400 hover:text-red-500">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                  <Upload className="w-7 h-7 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">클릭하여 파일 선택</span>
                  <input type="file" multiple accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={handleFileChange} />
                </label>
              </div>

              {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
                {loading ? '제출 중...' : '재신청하기'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
