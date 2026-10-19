from preset_compose import compose_final_preset


def test_base_preset_is_prepended():
    assert compose_final_preset("gallery", "upstream") == "upstream, gallery"


def test_without_a_base_preset_only_the_selection_is_returned():
    assert compose_final_preset("gallery") == "gallery"


def test_evaluated_preset_wins_over_the_raw_selection():
    # evaluated_preset is the frontend's expanded form: variants resolved and
    # rolls applied. It must take precedence over the raw selection.
    assert compose_final_preset("raw", "", "expanded") == "expanded"


def test_falls_back_to_the_raw_selection_for_older_workflows():
    assert compose_final_preset("raw, selection", "", "") == "raw, selection"


def test_whitespace_only_evaluated_preset_falls_back():
    assert compose_final_preset("raw", "", "   ") == "raw"


def test_whitespace_only_base_preset_is_dropped():
    assert compose_final_preset("gallery", "   ") == "gallery"


def test_whitespace_only_selection_yields_an_empty_string():
    assert compose_final_preset("   ", "   ", "   ") == ""


def test_both_sides_empty_yields_an_empty_string():
    assert compose_final_preset("") == ""
    assert compose_final_preset("", "", "") == ""


def test_parts_are_stripped():
    assert compose_final_preset("  gallery  ", "  upstream  ") == "upstream, gallery"


def test_no_stray_separator_when_one_side_is_empty():
    assert compose_final_preset("gallery", "") == "gallery"
    assert not compose_final_preset("gallery", "").endswith(",")
