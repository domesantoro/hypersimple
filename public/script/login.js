var loginL10n = ln10n_en;

function setLoginLanguage() {
    const params = new URLSearchParams(window.location.search);
    const lan = params.get("lan") || "en";

    switch (lan) {
        case "it":
            loginL10n = ln10n_it;
            break;
        default:
            loginL10n = ln10n_en;
            break;
    }
}

function applyLoginTexts() {
    $("#login_title").text(loginL10n["login_title"]);
    $("#login_email_label").text(loginL10n["login_email"]);
    $("#login_password_label").text(loginL10n["login_password"]);
    $("#login_button").text(loginL10n["login_button"]);
    $("#login_about_toggle").text(loginL10n["login_about"]);
    $("#login_disclaimer").html(loginL10n["login_disclaimer"]);
}

function bindLoginForm() {
    $("#login_form").on("submit", function (event) {
        event.preventDefault();

        $("#login_error").attr("hidden", true).text("");

        fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: $("#email").val(),
                password: $("#password").val()
            })
        }).then(function (response) {
            if (!response.ok) {
                throw new Error("Login failed");
            }

            window.location.href = "/";
        }).catch(function () {
            $("#login_error").text(loginL10n["login_invalid"]).removeAttr("hidden");
        });
    });
}

function bindDisclaimer() {
    $("#login_about_toggle").on("click", function () {
        const $disclaimer = $("#login_disclaimer");

        if ($disclaimer.attr("hidden")) {
            $disclaimer.removeAttr("hidden");
            return;
        }

        $disclaimer.attr("hidden", true);
    });
}

$(function () {
    setLoginLanguage();
    applyLoginTexts();
    bindLoginForm();
    bindDisclaimer();
});
