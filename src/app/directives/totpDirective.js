angular
    .module('bit.directives')

    .directive('totp', function ($timeout, $q) {
        return {
            template: '<div class="totp{{(low ? \' low\' : \'\')}}" ng-if="code">' +
            '<span class="totp-countdown"><span class="totp-sec">{{sec}}</span>' +
            '<svg><g><circle class="totp-circle inner" r="12.6" cy="16" cx="16" style="stroke-dashoffset: {{dash}}px;"></circle>' +
            '<circle class="totp-circle outer" r="14" cy="16" cx="16"></circle></g></svg></span>' +
            '<span class="totp-code" id="totp-code">{{codeFormatted}}</span>' +
            '<a href="#" stop-click class="btn btn-link" ngclipboard ngclipboard-error="clipboardError(e)" ' +
            'data-clipboard-text="{{code}}" uib-tooltip="Copy Code" tooltip-placement="right">' +
            '<i class="fa fa-clipboard"></i></a>' +
            '</div>',
            restrict: 'A',
            scope: {
                key: '=totp'
            },
            link: function (scope) {
                var interval = null;

                var Totp = function () {
                    var b32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

                    var leftpad = function (s, l, p) {
                        if (l + 1 >= s.length) {
                            s = Array(l + 1 - s.length).join(p) + s;
                        }
                        return s;
                    };

                    var dec2hex = function (d) {
                        return (d < 15.5 ? '0' : '') + Math.round(d).toString(16);
                    };

                    var hex2dec = function (s) {
                        return parseInt(s, 16);
                    };

                    var hex2bytes = function (s) {
                        var bytes = new Uint8Array(s.length / 2);
                        for (var i = 0; i < s.length; i += 2) {
                            bytes[i / 2] = parseInt(s.substr(i, 2), 16);
                        }
                        return bytes;
                    };

                    var buff2hex = function (buff) {
                        var bytes = new Uint8Array(buff);
                        var hex = [];
                        for (var i = 0; i < bytes.length; i++) {
                            hex.push((bytes[i] >>> 4).toString(16));
                            hex.push((bytes[i] & 0xF).toString(16));
                        }
                        return hex.join('');
                    };

                    var b32tohex = function (s) {
                        s = s.toUpperCase();
                        var cleanedInput = '';
                        var i;
                        for (i = 0; i < s.length; i++) {
                            if (b32Chars.indexOf(s[i]) < 0) {
                                continue;
                            }

                            cleanedInput += s[i];
                        }
                        s = cleanedInput;

                        var bits = '';
                        var hex = '';
                        for (i = 0; i < s.length; i++) {
                            var byteIndex = b32Chars.indexOf(s.charAt(i));
                            if (byteIndex < 0) {
                                continue;
                            }
                            bits += leftpad(byteIndex.toString(2), 5, '0');
                        }
                        for (i = 0; i + 4 <= bits.length; i += 4) {
                            var chunk = bits.substr(i, 4);
                            hex = hex + parseInt(chunk, 2).toString(16);
                        }
                        return hex;
                    };

                    var b32tobytes = function (s) {
                        return hex2bytes(b32tohex(s));
                    };

                    var sign = function (keyBytes, timeBytes) {
                        return window.crypto.subtle.importKey('raw', keyBytes,
                            { name: 'HMAC', hash: { name: 'SHA-1' } }, false, ['sign']).then(function (key) {
                                return window.crypto.subtle.sign({ name: 'HMAC', hash: { name: 'SHA-1' } }, key, timeBytes);
                            }).then(function (signature) {
                                return buff2hex(signature);
                            }).catch(function (err) {
                                return null;
                            });
                    };

                    this.getCode = function (keyb32) {
                        var epoch = Math.round(new Date().getTime() / 1000.0);
                        var timeHex = leftpad(dec2hex(Math.floor(epoch / 30)), 16, '0');
                        var timeBytes = hex2bytes(timeHex);
                        var keyBytes = b32tobytes(keyb32);

                        if (!keyBytes.length || !timeBytes.length) {
                            return $q(function (resolve, reject) {
                                resolve(null);
                            });
                        }

                        return sign(keyBytes, timeBytes).then(function (hashHex) {
                            if (!hashHex) {
                                return null;
                            }

                            var offset = hex2dec(hashHex.substring(hashHex.length - 1));
                            var otp = (hex2dec(hashHex.substr(offset * 2, 8)) & hex2dec('7fffffff')) + '';
                            otp = (otp).substr(otp.length - 6, 6);
                            return otp;
                        });
                    };
                };

                var totp = new Totp();

                var updateCode = function (scope) {
                    totp.getCode(scope.key).then(function (code) {
                        $timeout(function () {
                            if (code) {
                                scope.codeFormatted = code.substring(0, 3) + ' ' + code.substring(3);
                                scope.code = code;
                            }
                            else {
                                scope.code = null;
                                if (interval) {
                                    clearInterval(interval);
                                }
                            }
                        });
                    });
                };

                var tick = function (scope) {
                    $timeout(function () {
                        var epoch = Math.round(new Date().getTime() / 1000.0);
                        var mod = epoch % 30;
                        var sec = 30 - mod;

                        scope.sec = sec;
                        scope.dash = (2.62 * mod).toFixed(2);
                        scope.low = sec <= 7;
                        if (mod === 0) {
                            updateCode(scope);
                        }
                    });
                };

                scope.$watch('key', function () {
                    if (!scope.key) {
                        scope.code = null;
                        if (interval) {
                            clearInterval(interval);
                        }
                        return;
                    }

                    updateCode(scope);
                    tick(scope);

                    if (interval) {
                        clearInterval(interval);
                    }

                    interval = setInterval(function () {
                        tick(scope);
                    }, 1000);
                });

                scope.$on('$destroy', function () {
                    if (interval) {
                        clearInterval(interval);
                    }
                });

                scope.clipboardError = function (e) {
                    alert('Your web browser does not support easy clipboard copying.');
                };
            },
        };
    });
