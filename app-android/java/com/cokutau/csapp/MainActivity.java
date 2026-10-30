package com.cokutau.csapp;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

/**
 * 最小可用的 WebView 壳。
 *
 * 为什么不用现成的浏览器：要验证的是「App 内嵌 WebView」这个场景，
 * 它和手机浏览器有实质差别（安全区、键盘、返回键、Cookie 策略、UA）。
 *
 * 验收方式：
 *   打开调试后通过 CDP 直接在这个 WebView 里执行 JS，检查页面真实状态。
 */
public class MainActivity extends Activity {

    private static final String TAG = "CSApp";
    private WebView web;
    private TextView errorView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#0b0d12"));

        web = new WebView(this);
        web.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        errorView = new TextView(this);
        errorView.setTextColor(Color.parseColor("#f87171"));
        errorView.setTextSize(14);
        errorView.setPadding(40, 200, 40, 40);
        errorView.setVisibility(View.GONE);

        root.addView(web);
        root.addView(errorView);
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage：会话凭证要用
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        // 让页面自己按 viewport meta 适配，不要强行改字号
        s.setTextZoom(100);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
        // 移动端 UA 里区分一下，方便后端识别来源
        s.setUserAgentString(s.getUserAgentString() + " CsApp/0.1 (Android)");

        // 关键：打开调试，才能通过 CDP 验证页面状态
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                Log.i(TAG, "PAGE_FINISHED " + url);
            }

            @Override
            public void onReceivedError(WebView view, int code, String desc, String failingUrl) {
                Log.e(TAG, "PAGE_ERROR " + code + " " + desc + " " + failingUrl);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                Log.i(TAG, "CONSOLE " + m.messageLevel() + " " + m.message());
                return true;
            }
        });

        // 给 JS 一个回传通道，页面里可以调 CsApp.log(...)
        web.addJavascriptInterface(new Bridge(), "CsApp");

        String url = getUrlFromIntent();
        Log.i(TAG, "LOADING " + url);
        web.loadUrl(url);
    }

    private String getUrlFromIntent() {
        Intent it = getIntent();
        String u = it != null ? it.getStringExtra("url") : null;
        if (u != null && !u.isEmpty()) return u;
        // 默认：安卓模拟器里 10.0.2.2 就是宿主机的 127.0.0.1
        return "http://10.0.2.2:8000/chat";
    }

    public class Bridge {
        @JavascriptInterface
        public void log(String msg) {
            Log.i(TAG, "JS " + msg);
        }
        @JavascriptInterface
        public String platform() {
            return "android-webview";
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.loadUrl("about:blank");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
