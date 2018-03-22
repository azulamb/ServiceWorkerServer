function ConvertDefaultResult(data) { return data; }
const API = {
    get: (api, req) => {
        return fetch('/api/' + api, req).then((response) => { return response.json(); });
    },
    post: (api, data, req) => {
        if (!req) {
            req = {};
        }
        req.method = 'POST';
        if (data !== undefined) {
            req.body = JSON.stringify(data);
        }
        return API.get(api, req);
    },
    user: {
        registration: (name) => { return API.user.set(name); },
        get: () => { return API.get('user/get').then((data) => { return data; }); },
        set: (name) => { return API.post('user/set', { name: name }).then(ConvertDefaultResult); },
        leave: () => { return API.get('user/leave'); }
    },
};
class App {
    constructor() {
    }
    init(errorLegacy, noLegacy) {
        return this.initServiceWorker(errorLegacy, noLegacy);
    }
    isModernBrowser() {
        const dialog = document.createElement('dialog');
        if (typeof dialog.showModal !== 'function' || typeof dialog.close !== 'function') {
            return false;
        }
        return true;
    }
    updateServiceWorker(registration) {
        console.log('UpdateServiceWorker');
        return registration.update().then(() => {
            if (navigator.serviceWorker.controller) {
                return Promise.resolve({});
            }
            console.log('Reload!!!!');
            location.reload();
            throw 'ServiceWorker update.';
        });
    }
    initServiceWorker(errorLegacy, noLegacy) {
        const errtimer = setTimeout(() => { errorLegacy(); }, 500);
        if (!('serviceWorker' in navigator)) {
            throw 'ServiceWorker notfound.';
        }
        if (!this.isModernBrowser()) {
            throw 'This browser is legacy.';
        }
        clearTimeout(errtimer);
        noLegacy();
        navigator.serviceWorker.register('./sw.js',{scope:'./'});
        return navigator.serviceWorker.ready.then((registration) => {
            if (!registration.active) {
                throw 'ServiceWorker not active.';
            }
            registration.addEventListener('updatefound', (event) => {
                console.log('updatefound', event);
            });
            document.getElementById('updsw').addEventListener('click', (event) => {
                this.updateServiceWorker(registration);
            }, false);
            return this.updateServiceWorker(registration);
        }).catch((error) => { console.log(error); });
    }
    setDialog(basename) {
        const button = document.getElementById('edit_' + basename);
        const dialog = document.getElementById('dialog_' + basename);
        if (!button || !dialog) {
            return null;
        }
        const close = document.createElement('button');
        close.addEventListener('click', () => { dialog.close(); }, false);
        dialog.appendChild(close);
        const cancel = document.getElementById('cancel_' + basename);
        if (cancel) {
            cancel.addEventListener('click', () => { dialog.close(); }, false);
        }
        button.addEventListener('click', () => {
            dialog.showModal();
        }, false);
        return dialog;
    }
    initEdit() {
        this.initEditUserData();
    }
    initEditUserData() {
        const dialog = this.setDialog('userdata');
    }
    getTheme() {
        const theme = {
            backColor: '',
            backColorAlpha: '',
        };
        Object.keys(theme).forEach((key) => {
            theme[key] = document.documentElement.style.getPropertyValue('--' + key);
        });
        return theme;
    }
    setTheme(theme) {
        Object.keys(theme).forEach((key) => {
            document.documentElement.style.setProperty('--' + key, theme[key]);
        });
    }
}
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init(() => {
        document.getElementById('legacy').classList.add('view');
    }, () => {
        app.initEdit();
        document.getElementById('legacy').classList.add('hide');
    }).then(() => {
        API.user.get().then((data) => {
            if (!data.name) {
                document.getElementById('post_registration').addEventListener('click', () => {
                    const value = document.getElementById('login_name').value;
                    API.user.registration(value).then((result) => {
                        location.reload();
                    }).catch((error) => {
                        console.log(error);
                    });
                }, false);
                return;
            }
            const theme = app.getTheme();
            document.getElementById('name').textContent = data.name;
            document.getElementById('post_leave').addEventListener('click', () => {
                API.user.leave().then(() => {
                    location.reload();
                });
            }, false);
            document.body.classList.add('logined');
        });
    }).catch((error) => {
        console.log(error);
    });
});
