/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as sizeUnits from "gshell://lib/adaptui/src/sizeunits.js";
import * as astronaut from "gshell://lib/adaptui/astronaut/astronaut.js";

import * as settings from "./script.js";

const RECOVERABLE_ERRORS = [
    "GOS_UPDATE_ALREADY_IN_PROGRESS",
    "GOS_UPDATE_CANCELLED",
    "GOS_UPDATE_FAIL_PKG_LIST",
    "GOS_UPDATE_FAIL_GET_ARCHIVE_DL_SIZE",
    "GOS_UPDATE_FAIL_START_ARCHIVE_DL",
    "GOS_UPDATE_FAIL_ARCHIVE_DL",
    "GOS_UPDATE_IMPL_BAD_ARCHIVE_DL_STATUS",
    "GOS_UPDATE_FAIL_START_PKG_DL",
    "GOS_UPDATE_FAIL_PKG_DL",
    "GOS_UPDATE_IMPL_BAD_PKG_DL_STATUS",
    "GOS_UPDATE_FAIL_DEL_FOLDER",
    "GOS_UPDATE_FAIL_NEW_FOLDER",
    "GOS_UPDATE_FAIL_START_ARCHIVE_EXTRACT",
    "GOS_UPDATE_FAIL_ARCHIVE_EXTRACT",
    "GOS_UPDATE_IMPL_BAD_ARCHIVE_EXTRACT_STATUS",
    "GOS_UPDATE_FAIL_DEL_ARCHIVE"
];

export var UpdatesPage = astronaut.component("UpdatesPage", function(props, children) {
    const updateStates = {
        LOADING_INDEX: 0,
        UPDATE_AVAILABLE: 1,
        UP_TO_DATE: 2,
        FAILED: 3,
        OFFLINE: 4
    };

    var updateBeingCancelled = false;

    var page = Page() ();
    var readyToUpdateContainer = Container() ();
    var updateProgressIndicator = ProgressIndicator({mode: "secondary"}) ();
    var updateStatusMessage = Paragraph() ();
    var updateNoPowerOffMessage = Paragraph() (BoldTextFragment() (_("updates_powerWarning")));
    var updateNowButton = null;
    var updateCancelButton = Button() (_("cancel"));
    var autoRestartCheckbox = CheckboxInput({mode: "secondary"}) ();
    var restartButton = Button() (_("updates_restart"));
    var cancelRestartButton = Button({mode: "secondary"}) (_("updates_cancelRestart"));

    var updateInProgressContainer = Container (
        updateProgressIndicator,
        updateStatusMessage,
        updateNoPowerOffMessage,
        Label (
            autoRestartCheckbox,
            _("updates_restartAfterComplete")
        ),
        ButtonRow (
            updateCancelButton
        )
    );

    var autoRestartCountdown = Paragraph({
        styles: {
            textAlign: "center",
            fontSize: "4rem",
            fontWeight: "bold"
        }
    }) ();

    var autoRestartContainer = Container (
        Paragraph() (BoldTextFragment() (_("updates_readyToRestart_autoRestartWarning"))),
        autoRestartCountdown
    );

    var readyToRestartContainer = Container (
        Separator() (),
        Paragraph() (_("updates_readyToRestart_description")),
        autoRestartContainer,
        ButtonRow (
            restartButton,
            cancelRestartButton
        )
    );

    updateCancelButton.on("click", function() {
        _sphere.callPrivilegedCommand("updates_cancelUpdate");

        updateCancelButton.setAttribute("disabled", true);

        updateBeingCancelled = true;
    });

    restartButton.on("click", function() {
        _sphere.callPrivilegedCommand("updates_setShouldAutoRestart", {value: false}).then(function() {
            _sphere.callPrivilegedCommand("power_restart");
        });
    });

    cancelRestartButton.on("click", function() {
        _sphere.callPrivilegedCommand("updates_setShouldAutoRestart", {value: false});
    })

    autoRestartCheckbox.on("change", function() {
        _sphere.callPrivilegedCommand("updates_setShouldAutoRestart", {value: autoRestartCheckbox.getValue()});
    });

    updateInProgressContainer.hide();
    readyToRestartContainer.hide();

    var lastState = null;

    function updateData() {
        var data = _sphere.getPrivilegedData();
        var currentState = null;

        autoRestartCheckbox.setValue(data?.updates_shouldAutoRestart);

        if (data?.updates_shouldAutoRestart) {
            autoRestartCountdown.setText(_format(data?.updates_autoRestartCountdownValue));
            autoRestartContainer.show();
            cancelRestartButton.show();
        } else {
            autoRestartContainer.hide();
            cancelRestartButton.hide();
        }

        if (!data?.updates_canCancelUpdate) {
            updateCancelButton.setAttribute("disabled", true);
            updateCancelButton.setAttribute("title", _("updates_cannotCancel"));

            updateNoPowerOffMessage.show();
        } else {
            if (updateBeingCancelled) {
                updateCancelButton.setAttribute("disabled", true);
            } else {
                updateCancelButton.removeAttribute("disabled");
            }

            updateCancelButton.removeAttribute("title");
            updateCancelButton.removeAttribute("sphere-:title");

            updateNoPowerOffMessage.hide();
        }

        readyToUpdateContainer.hide();
        updateInProgressContainer.hide();
        readyToRestartContainer.hide();

        if (data?.updates_updateStatus == "readyToRestart") {
            readyToRestartContainer.show();
        } else if (data?.updates_updateInProgress) {
            updateInProgressContainer.show();

            updateStatusMessage.setText(_(`updates_status_${data?.updates_updateStatus}`, {
                progress: data?.updates_updateProgress != null ? Math.round(data?.updates_updateProgress * 100) : null
            }));

            if (data?.updates_updateProgress != null) {
                updateProgressIndicator.setValue(data?.updates_updateProgress);
            } else {
                updateProgressIndicator.removeAttribute("value");
            }
            
            if (lastState == updateStates.UPDATE_AVAILABLE) {
                return;
            }
        } else {
            readyToUpdateContainer.show();

            updateNowButton?.removeAttribute("disabled");

            updateBeingCancelled = false;
        }
        
        if (data?.updates_checkingFailed) {
            if (!navigator.onLine) {
                currentState = updateStates.OFFLINE;
            } else {
                currentState = updateStates.FAILED;
            }
        } else if (data?.updates_loadingIndex) {
            currentState = updateStates.LOADING_INDEX;
        } else if (data?.updates_index) {
            if (data?.updates_bestUpdate) {
                currentState = updateStates.UPDATE_AVAILABLE;
            } else {
                currentState = updateStates.UP_TO_DATE;
            }
        } else {
            _sphere.callPrivilegedCommand("updates_getUpdates");

            currentState = updateStates.LOADING_INDEX;
        }

        if (currentState == lastState) {
            return;
        }

        lastState = currentState;

        page.clear();

        switch (currentState) {
            case updateStates.LOADING_INDEX:
                page.add(
                    Section (
                        SkeletonLoader(_("updates_loading")) (
                            Heading() (),
                            Card (
                                Heading(2) (),
                                Paragraph() (),
                                Paragraph() (),
                                Paragraph() (),
                                Separator() (),
                                Paragraph() (),
                                ButtonRow (
                                    Button() ()
                                )
                            )
                        )
                    )
                );

                break;

            case updateStates.UPDATE_AVAILABLE:
                var update = data?.updates_bestUpdate;

                updateNowButton = Button() (_("updates_updateNow"));

                updateNowButton.on("click", function() {
                    _sphere.callPrivilegedCommand("updates_startUpdate", {update}).catch(function(error) {
                        console.error("Error occured during update:", error);

                        var dialog = UpdateFailureDialog({error, isRecoverable: RECOVERABLE_ERRORS.includes(error)}) ();

                        settings.registerDialog(dialog);

                        dialog.dialogOpen();
                    });

                    updateNowButton.setAttribute("disabled", true);
                });

                readyToUpdateContainer.clear().add(
                    Separator() (),
                    Paragraph() (_("updates_info_estimatedDownloadSize", {size: sizeUnits.getString(update.estimatedDownloadSize, _)})),
                    ButtonRow (
                        updateNowButton
                    )
                );

                page.add(
                    Section (
                        Heading() (_("updates_latest")),
                        Card({mode: "keepUnlinked"}) (
                            Heading({
                                level: 2,
                                styles: {
                                    fontSize: "1.5rem"
                                }
                            }) (
                                BrandWordmark(_("updates_info_name").trim(), "gshell://media/logo.svg") (_("updates_info_name")),
                                TextFragment({
                                    styles: {
                                        fontWeight: "normal"
                                    }
                                }) (_("updates_info_version", {version: update.version}))
                            ),
                            Container() ().setHTML(new showdown.Converter({
                                headerLevelStart: 3,
                                openLinksInNewWindow: true
                            }).makeHtml(new showdown.Converter().makeHtml(update.description[$g.l10n.getSystemLocaleCode()] || update.description[update.fallbackLocale] || ""))),
                            readyToUpdateContainer,
                            updateInProgressContainer,
                            readyToRestartContainer
                        )
                    )
                );

                break;

            case updateStates.UP_TO_DATE:
            case updateStates.FAILED:
            case updateStates.OFFLINE:
                var checkAgainButton = Button() (_("updates_checkAgain"));

                checkAgainButton.on("click", function() {
                    _sphere.callPrivilegedCommand("updates_getUpdates");
                });

                page.add(
                    Section (
                        Message (
                            Icon({
                                [updateStates.UP_TO_DATE]: "checkmark",
                                [updateStates.FAILED]: "error",
                                [updateStates.OFFLINE]: "offline"
                            }[currentState], "dark embedded") (),
                            Heading() ({
                                [updateStates.UP_TO_DATE]: _("updates_upToDate_title"),
                                [updateStates.FAILED]: _("updates_checkingFailed_title"),
                                [updateStates.OFFLINE]: _("updates_offline_title")
                            }[currentState]),
                            Paragraph() ({
                                [updateStates.UP_TO_DATE]: _("updates_upToDate_description"),
                                [updateStates.FAILED]: _("updates_checkingFailed_description"),
                                [updateStates.OFFLINE]: _("updates_offline_description")
                            }[currentState]),
                            ButtonRow (
                                checkAgainButton
                            )
                        )
                    )
                );
        }
    }

    _sphere.onPrivilegedDataUpdate(updateData);
    updateData();

    return page;
});

export var UpdateFailureDialog = astronaut.component("UpdateFailureDialog", function(props, children) {
    return Dialog (
        Heading() (_("updates_failed_title")),
        DialogContent (
            Paragraph() (props.isRecoverable ? _("updates_failed_description_recoverable") : _("updates_failed_description_unstable")),
            Paragraph (
                Text(_("updates_failed_error")),
                Text(" "),
                CodeSnippet() (props.error || "GOS_UPDATE_UNKNOWN")
            )
        ),
        ButtonRow("end") (
            Button({
                attributes: {
                    "aui-bind": "close"
                }
            }) (_("ok"))
        )
    );
});