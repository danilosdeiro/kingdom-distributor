package com.meukingdom.app;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private static final String RELEASE_PATH = "/danilosdeiro/kingdom-distributor/releases/download/";
    private static final String APK_MIME_TYPE = "application/vnd.android.package-archive";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private long activeDownloadId = -1;
    private File activeApk;

    @PluginMethod
    public void canInstallPackages(PluginCall call) {
        JSObject result = new JSObject();
        result.put("allowed", Build.VERSION.SDK_INT < Build.VERSION_CODES.O
            || getContext().getPackageManager().canRequestPackageInstalls());
        call.resolve(result);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        String fileName = call.getString("fileName", "MeuKingdom-update.apk");

        if (!isOfficialRelease(url) || !fileName.matches("MeuKingdom-[0-9.]+\\.apk")) {
            call.reject("Atualizacao recusada por seguranca.");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            && !getContext().getPackageManager().canRequestPackageInstalls()) {
            call.reject("Autorize a instalacao de atualizacoes primeiro.", "INSTALL_PERMISSION_REQUIRED");
            return;
        }
        if (activeDownloadId != -1) {
            call.reject("Ja existe uma atualizacao sendo baixada.", "DOWNLOAD_IN_PROGRESS");
            return;
        }

        File downloadDir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (downloadDir == null) {
            call.reject("O armazenamento do aparelho nao esta disponivel.");
            return;
        }

        activeApk = new File(downloadDir, fileName);
        if (activeApk.exists() && !activeApk.delete()) {
            call.reject("Nao foi possivel substituir o arquivo de atualizacao anterior.");
            activeApk = null;
            return;
        }

        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url))
            .setTitle("MeuKingdom " + fileName.replace("MeuKingdom-", "").replace(".apk", ""))
            .setDescription("Baixando atualizacao")
            .setMimeType(APK_MIME_TYPE)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(false)
            .setDestinationUri(Uri.fromFile(activeApk));

        DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        activeDownloadId = manager.enqueue(request);
        pollDownload(manager);

        JSObject result = new JSObject();
        result.put("started", true);
        call.resolve(result);
    }

    private boolean isOfficialRelease(String value) {
        if (value == null) return false;
        Uri uri = Uri.parse(value);
        return "https".equals(uri.getScheme())
            && "github.com".equals(uri.getHost())
            && uri.getPath() != null
            && uri.getPath().startsWith(RELEASE_PATH);
    }

    private void pollDownload(DownloadManager manager) {
        handler.postDelayed(() -> {
            if (activeDownloadId == -1) return;

            try (Cursor cursor = manager.query(new DownloadManager.Query().setFilterById(activeDownloadId))) {
                if (cursor == null || !cursor.moveToFirst()) {
                    failDownload("O Android perdeu o download da atualizacao.");
                    return;
                }

                int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                long downloaded = cursor.getLong(cursor.getColumnIndexOrThrow(
                    DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR
                ));
                long total = cursor.getLong(cursor.getColumnIndexOrThrow(
                    DownloadManager.COLUMN_TOTAL_SIZE_BYTES
                ));

                JSObject progress = new JSObject();
                progress.put("downloadedBytes", downloaded);
                progress.put("totalBytes", total);
                progress.put("percent", total > 0 ? Math.min(100, (int) ((downloaded * 100) / total)) : 0);
                notifyListeners("downloadProgress", progress);

                if (status == DownloadManager.STATUS_SUCCESSFUL) {
                    File apk = activeApk;
                    activeDownloadId = -1;
                    activeApk = null;
                    notifyListeners("downloadComplete", new JSObject());
                    openInstaller(apk);
                    return;
                }
                if (status == DownloadManager.STATUS_FAILED) {
                    int reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON));
                    failDownload("Falha no download da atualizacao. Codigo " + reason + ".");
                    return;
                }
            }

            pollDownload(manager);
        }, 500);
    }

    private void failDownload(String message) {
        activeDownloadId = -1;
        activeApk = null;
        JSObject error = new JSObject();
        error.put("message", message);
        notifyListeners("downloadError", error);
    }

    private void openInstaller(File apk) {
        if (apk == null || !apk.exists()) {
            failDownload("O arquivo baixado nao foi encontrado.");
            return;
        }

        Uri apkUri = FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            apk
        );
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(apkUri, APK_MIME_TYPE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
    }

    @Override
    protected void handleOnDestroy() {
        handler.removeCallbacksAndMessages(null);
        super.handleOnDestroy();
    }
}
