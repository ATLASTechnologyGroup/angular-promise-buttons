angular.module('angularPromiseButtons', []);

angular.module('angularPromiseButtons')
    .directive('promiseBtn', ['angularPromiseButtons', '$parse', '$timeout', '$q', function(angularPromiseButtons, $parse, $timeout, $q) {
        'use strict';

        var CLICK_EVENT = 'click';
        var CLICK_ATTR = 'ngClick';
        var SUBMIT_EVENT = 'submit';
        var SUBMIT_ATTR = 'ngSubmit';

        return {
            restrict: 'EA',
            priority: angularPromiseButtons.config.priority,
            scope: {
                promiseBtn: '=',
                promiseBtnOptions: '=?'
            },
            link: function(scope, el, attrs) {
                var providerCfg = angularPromiseButtons.config;
                var cfg = providerCfg;
                var promiseWatcher;
                var timeout;
                var timeoutDone;
                var promiseDone;


                function handleLoading(btnEl) {
                    if (cfg.btnLoadingClass && !cfg.addClassToCurrentBtnOnly) {
                        btnEl.addClass(cfg.btnLoadingClass);
                    }
                    if (cfg.disableBtn && !cfg.disableCurrentBtnOnly) {
                        btnEl.attr('disabled', 'disabled');
                    }
                }

                function handleLoadingFinished(btnEl) {
                    if ((!cfg.minDuration || timeoutDone) && promiseDone) {
                        if (cfg.btnLoadingClass) {
                            btnEl.removeClass(cfg.btnLoadingClass);
                        }
                        if (cfg.disableBtn) {
                            btnEl.removeAttr('disabled');
                        }
                    }
                }

                function showFinishStatus(btnEl, isSuccess) {
                    if (cfg.btnLoadingClass) {
                        btnEl.removeClass(cfg.btnLoadingClass);

                        var cssClass = isSuccess ? cfg.btnLoadingComplete : cfg.btnLoadingFail;
                        btnEl.addClass(cssClass);
                        $timeout(function () {
                            btnEl.removeClass(cssClass);
                        }, cfg.btnLoadingCompleteReset);
                    }
                }

                function initPromiseWatcher(watchExpressionForPromise, btnEl) {
                    // watch promise to resolve or fail
                    scope.$watch(watchExpressionForPromise, function(mVal) {
                        timeoutDone = false;
                        promiseDone = false;
                        var isSuccess = false;
                        // create timeout if option is set
                        if (cfg.minDuration) {
                            timeout = $timeout(function() {
                                timeoutDone = true;
                                handleLoadingFinished(btnEl);
                            }, cfg.minDuration);
                        }

                        // for regular promises
                        if (mVal && mVal.then) {
                            handleLoading(btnEl);
                            mVal.then(success, error).finally(always);
                        }
                        // for $resource
                        else if (mVal && mVal.$promise) {
                            handleLoading(btnEl);
                            mVal.$promise.then(success, error).finally(always);
                        }

                        function success (response) {
                            isSuccess = response && response.IsError ? false : true;
                            return response; 
                        }
                        function error (err) {
                            isSuccess = false;
                            return $q.reject(err);
                        }
                        function always () {
                            promiseDone = true;
                            showFinishStatus(btnEl, isSuccess);
                            handleLoadingFinished(btnEl);
                        }
                    });
                }

                function getCallbacks(expression) {
                    return expression
                    // split by ; to get different functions if any
                        .split(';')
                        .map(function(callback) {
                            // return getter function
                            return $parse(callback);
                        });
                }

                function appendSpinnerTpl(btnEl) {
                    if (btnEl.find('.btn-spinner').length == 0) {
                        if (scope.prepend) {
                            btnEl.prepend(cfg.spinnerTpl);
                        } else {
                            btnEl.append(cfg.spinnerTpl);
                        }
                    }
                }

                function addHandlersForCurrentBtnOnly(btnEl) {
                    // handle current button only options via click
                    if (cfg.addClassToCurrentBtnOnly) {
                        btnEl.on(CLICK_EVENT, function() {
                            btnEl.addClass(cfg.btnLoadingClass);
                        });
                    }

                    if (cfg.disableCurrentBtnOnly) {
                        btnEl.on(CLICK_EVENT, function() {
                            btnEl.attr('disabled', 'disabled');
                        });
                    }
                }

                function initHandlingOfViewFunctionsReturningAPromise(eventToHandle, attrToParse, btnEl) {
                    // we need to use evalAsync here, as
                    // otherwise the click or submit event
                    // won't be ready to be replaced
                    scope.$evalAsync(function() {
                        var callbacks = getCallbacks(attrs[attrToParse]);

                        // unbind original click event
                        el.unbind(eventToHandle);

                        // rebind, but this time watching it's return value
                        el.bind(eventToHandle, function() {
                            // Make sure we run the $digest cycle
                            scope.$apply(function() {
                                callbacks.forEach(function(cb) {
                                    // execute function on parent scope
                                    // as we're in an isolate scope here
                                    var promise = cb(scope.$parent, {$event: eventToHandle});

                                    // only init watcher if not done before
                                    if (!promiseWatcher) {
                                        promiseWatcher = initPromiseWatcher(function() {
                                            return promise;
                                        }, btnEl);
                                    }
                                });
                            });
                        });
                    });
                }

                function getSubmitBtnChildren(el) {
                    var submitBtnEls = [];
                    var allButtonEls = el.find('button');

                    for (var i = 0; i < allButtonEls.length; i++) {
                        var btnEl = allButtonEls[i];
                        if (angular.element(btnEl)
                                .attr('type') === 'submit') {
                            submitBtnEls.push(btnEl);
                        }
                    }
                    return angular.element(submitBtnEls);
                }


                // INIT
                // check if there is any value given via attrs.promiseBtn
                if (!attrs.promiseBtn) {
                    // handle ngClick function directly returning a promise
                    if (attrs.hasOwnProperty(CLICK_ATTR)) {
                        appendSpinnerTpl(el);
                        addHandlersForCurrentBtnOnly(el);
                        initHandlingOfViewFunctionsReturningAPromise(CLICK_EVENT, CLICK_ATTR, el);
                    }
                    // handle ngSubmit function directly returning a promise
                    else if (attrs.hasOwnProperty(SUBMIT_ATTR)) {
                        // get child submits for form elements
                        var btnElements = getSubmitBtnChildren(el);

                        appendSpinnerTpl(btnElements);
                        addHandlersForCurrentBtnOnly(btnElements);
                        initHandlingOfViewFunctionsReturningAPromise(SUBMIT_EVENT, SUBMIT_ATTR, btnElements);
                    }
                }
                // handle promises passed via scope.promiseBtn
                else {
                    appendSpinnerTpl(el);
                    addHandlersForCurrentBtnOnly(el);
                    // handle promise passed directly via attribute as variable
                    initPromiseWatcher(function() {
                        return scope.promiseBtn;
                    }, el);
                }


                // watch and update options being changed
                scope.$watch('promiseBtnOptions', function(newVal) {
                    if (angular.isObject(newVal)) {
                        cfg = angular.extend({}, providerCfg, newVal);
                    }
                }, true);

                // cleanup
                scope.$on('$destroy', function() {
                    $timeout.cancel(timeout);
                });
            }
        };
    }]);

angular.module('angularPromiseButtons')
    .provider('angularPromiseButtons', function angularPromiseButtonsProvider() {
        'use strict';

        // *****************
        // DEFAULTS & CONFIG
        // *****************

        var config = {
            spinnerTpl: '<span class="btn-spinner"></span>',
            priority: 0,
            disableBtn: true,
            btnLoadingClass: 'is-loading',
            btnLoadingComplete: 'completed-loading',
            btnLoadingFail: 'fail-loading',
            btnLoadingCompleteReset: 3000,
            prepend: false,
            addClassToCurrentBtnOnly: false,
            disableCurrentBtnOnly: false,
            minDuration: false,
            CLICK_EVENT: 'click',
            CLICK_ATTR: 'ngClick',
            SUBMIT_EVENT: 'submit',
            SUBMIT_ATTR: 'ngSubmit'
        };

        // *****************
        // SERVICE-FUNCTIONS
        // *****************


        // *************************
        // PROVIDER-CONFIG-FUNCTIONS
        // *************************

        return {
            extendConfig: function(newConfig) {
                config = angular.extend(config, newConfig);
            },


            // ************************************************
            // ACTUAL FACTORY FUNCTION - used by the directive
            // ************************************************

            $get: function() {
                return {
                    config: config
                };
            }
        };
    });

