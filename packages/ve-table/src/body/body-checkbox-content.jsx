import VeCheckbox from "vue-easytable/packages/ve-checkbox";
import {
    COMPS_NAME,
    EMIT_EVENTS,
    COLUMN_TYPES,
    EXPAND_TRIGGER_TYPES
} from "../util/constant";
import { clsName } from "../util";
import emitter from "../../../src/mixins/emitter";
export default {
    name: COMPS_NAME.VE_TABLE_BODY_CHECKBOX_CONTENT,
    mixins: [emitter],
    props: {
        // checkbox option
        checkboxOptipon: {
            type: Object,
            default: function() {
                return null;
            }
        },
        rowKey: {
            type: [String, Number],
            required: true
        },
        internalCheckboxSelectedRowKeys: {
            type: Array,
            default: function() {
                return null;
            }
        }
    },
    data() {
        return {
            isSelected: false
        };
    },
    computed: {
        // disabled
        disabled() {
            let result = false;

            const { checkboxOptipon, rowKey } = this;

            if (!checkboxOptipon) {
                return;
            }

            const { disableSelectedRowKeys } = checkboxOptipon;

            if (
                Array.isArray(disableSelectedRowKeys) &&
                disableSelectedRowKeys.includes(rowKey)
            ) {
                result = true;
            }

            return result;
        },

        // 是否是受控属性（取决于selectedRowKeys）
        isControlledProp() {
            const { checkboxOptipon } = this;

            return (
                checkboxOptipon &&
                Array.isArray(checkboxOptipon.selectedRowKeys)
            );
        }
    },
    watch: {
        // watch internalCheckboxSelectedRowKeys
        internalCheckboxSelectedRowKeys: {
            handler: function() {
                this.initSelected();
            },
            immediate: true
        }
    },
    methods: {
        // init selected
        initSelected() {
            let result = false;

            const { rowKey, internalCheckboxSelectedRowKeys } = this;

            if (
                Array.isArray(internalCheckboxSelectedRowKeys) &&
                internalCheckboxSelectedRowKeys.includes(rowKey)
            ) {
                result = true;
            }

            this.isSelected = result;
        },

        // selected change
        selectedChange(isSelected) {
            const { checkboxOptipon, rowKey, isControlledProp } = this;

            // 非受控
            if (!isControlledProp) {
                this.isSelected = isSelected;
            }

            this.dispatch(
                COMPS_NAME.VE_TABLE_BODY,
                EMIT_EVENTS.CHECKBOX_SELECTED_ROW_CHANGE,
                {
                    rowKey: this.rowKey,
                    isSelected
                }
            );
        }
    },
    render() {
        const { isSelected, selectedChange, label, disabled } = this;

        const checkboxProps = {
            class: clsName("checkbox-wrapper"),
            props: {
                isControlled: true,
                isSelected: isSelected,
                disabled
            },
            on: {
                "on-checked-change": isSelected => selectedChange(isSelected)
            }
        };

        return <VeCheckbox {...checkboxProps} />;
    }
};
