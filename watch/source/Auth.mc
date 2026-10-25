import Toybox.Cryptography;
import Toybox.Lang;
import Toybox.StringUtil;

// The secret never leaves the watch: the worker knows the device by the
// secret's SHA-256 and checks an HMAC over the request fields.
(:background :glance)
module Auth {
    const FIELD_SEPARATOR = "\n";

    function deviceId(secret as ByteArray) as String {
        var hash = new Cryptography.Hash({ :algorithm => Cryptography.HASH_SHA256 });
        hash.update(secret);
        return hex(hash.digest());
    }

    function sign(secret as ByteArray, fields as Array<String>) as String {
        var message = "";
        for (var i = 0; i < fields.size(); i++) {
            message += (i > 0 ? FIELD_SEPARATOR : "") + fields[i];
        }
        var hmac = new Cryptography.HashBasedMessageAuthenticationCode({ :algorithm => Cryptography.HASH_SHA256, :key => secret });
        hmac.update(convert(message, StringUtil.REPRESENTATION_STRING_PLAIN_TEXT, StringUtil.REPRESENTATION_BYTE_ARRAY) as ByteArray);
        return hex(hmac.digest());
    }

    function hex(bytes as ByteArray) as String {
        return convert(bytes, StringUtil.REPRESENTATION_BYTE_ARRAY, StringUtil.REPRESENTATION_STRING_HEX) as String;
    }

    function convert(input as String or ByteArray, from as StringUtil.Representation, to as StringUtil.Representation) as String or ByteArray {
        return StringUtil.convertEncodedString(input, { :fromRepresentation => from, :toRepresentation => to });
    }
}
